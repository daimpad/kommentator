<?php
/**
 * deploy.php — Auslieferung auf einen eigenen Webserver per GitHub-Webhook.
 * ---------------------------------------------------------------------------
 * Liegt das Repository als Git-Klon im Webroot, holt dieses Skript nach jedem
 * Push auf `main` den neuen Stand. GitHub schickt dazu einen POST an
 *
 *     https://<deine-domain>/deploy.php
 *
 * Einrichtung siehe TUTORIAL.md, Abschnitt „Auf einen eigenen Server
 * ausliefern". Kurz:
 *   1. Geheimwort würfeln:  openssl rand -hex 32
 *   2. Es AUSSERHALB des Webroots ablegen, eine Ebene über dem Klon:
 *        echo '<geheimwort>' > ../.kommentator-deploy-secret
 *        chmod 600 ../.kommentator-deploy-secret
 *      (oder als Umgebungsvariable KOMMENTATOR_DEPLOY_SECRET)
 *   3. In GitHub: Settings → Webhooks → Add webhook, Content type
 *      application/json, dasselbe Geheimwort als „Secret", nur das
 *      Ereignis „push".
 *
 * Grundsätze:
 *   - In dieser Datei steht KEIN Geheimnis. Wer sie liest, gewinnt nichts.
 *   - Ohne gültige Signatur passiert gar nichts — geprüft wird mit
 *     hash_equals() über den rohen Rumpf, nicht über geparste Felder.
 *   - Es wird nur geholt, nie gepusht: `fetch` + `reset --hard`. Der Klon ist
 *     eine Auslieferung, kein Arbeitsplatz; lokale Änderungen an versionierten
 *     Dateien gehen dabei verloren. Das ist die Absicht.
 *   - Zwei gleichzeitige Zustellungen stolpern nicht übereinander (Sperrdatei).
 * ======================================================================== */

/** Zweig, der ausgeliefert wird. */
function kommentator_deploy_zweig() {
    $zweig = getenv('KOMMENTATOR_DEPLOY_BRANCH');
    return is_string($zweig) && $zweig !== '' ? $zweig : 'main';
}

/** Verzeichnis des Klons — dort, wo diese Datei liegt. */
function kommentator_deploy_verzeichnis() {
    return __DIR__;
}

/**
 * Das gemeinsame Geheimwort.
 * Erst die Umgebungsvariable, dann eine Datei eine Ebene über dem Klon.
 * Leer heißt: nicht eingerichtet — dann wird nichts ausgeliefert.
 */
function kommentator_deploy_geheimnis() {
    $aus_umgebung = getenv('KOMMENTATOR_DEPLOY_SECRET');
    if (is_string($aus_umgebung) && trim($aus_umgebung) !== '') {
        return trim($aus_umgebung);
    }
    $datei = dirname(kommentator_deploy_verzeichnis()) . '/.kommentator-deploy-secret';
    if (is_readable($datei)) {
        $inhalt = trim((string) file_get_contents($datei));
        if ($inhalt !== '') {
            return $inhalt;
        }
    }
    return '';
}

/**
 * Signatur prüfen — der Kern der ganzen Sache.
 *
 * GitHub schickt `X-Hub-Signature-256: sha256=<hmac>` über den ROHEN Rumpf.
 * Verglichen wird mit hash_equals(): ein gewöhnliches === bräuchte je nach
 * Übereinstimmung unterschiedlich lange und verriete das Geheimnis
 * Zeichen für Zeichen.
 */
function kommentator_deploy_signatur_ok($rumpf, $kopfzeile, $geheim) {
    if (!is_string($geheim) || $geheim === '') {
        return false;   // nicht eingerichtet: im Zweifel nichts tun
    }
    if (!is_string($kopfzeile) || strpos($kopfzeile, 'sha256=') !== 0) {
        return false;
    }
    $erwartet = 'sha256=' . hash_hmac('sha256', (string) $rumpf, $geheim);
    return hash_equals($erwartet, $kopfzeile);
}

/**
 * Den Zweig aus dem Rumpf lesen.
 * GitHub kann als JSON oder als Formular (`payload=…`) zustellen.
 * Rückgabe: der Ref-Name (z. B. „refs/heads/main") oder ''.
 */
function kommentator_deploy_ref($rumpf, $inhaltstyp = 'application/json') {
    $roh = (string) $rumpf;
    if (strpos((string) $inhaltstyp, 'application/x-www-form-urlencoded') === 0) {
        parse_str($roh, $felder);
        $roh = isset($felder['payload']) ? (string) $felder['payload'] : '';
    }
    $daten = json_decode($roh, true);
    if (!is_array($daten) || !isset($daten['ref']) || !is_string($daten['ref'])) {
        return '';
    }
    return $daten['ref'];
}

/** Eine Zeile ins Protokoll — nie ein Grund, die Auslieferung abzubrechen. */
function kommentator_deploy_protokoll($zeile) {
    $datei = dirname(kommentator_deploy_verzeichnis()) . '/kommentator-deploy.log';
    $stempel = gmdate('Y-m-d H:i:s') . ' UTC  ';
    @file_put_contents($datei, $stempel . $zeile . "\n", FILE_APPEND | LOCK_EX);
}

/**
 * Den neuen Stand holen.
 *
 * `-c safe.directory` ist kein Beiwerk: Gehört der Klon einem anderen Konto
 * als dem, unter dem PHP läuft, verweigert Git sonst mit „dubious ownership"
 * die Arbeit — der häufigste Grund, warum so ein Haken scheinbar grundlos
 * nichts tut. HOME wird gesetzt, weil der Webserver-Benutzer oft keines hat.
 */
function kommentator_deploy_ausfuehren($verzeichnis, $zweig) {
    $ergebnis = array('ok' => false, 'ausgabe' => array(), 'stand' => '');
    if (!is_dir($verzeichnis . '/.git')) {
        $ergebnis['ausgabe'][] = 'Kein Git-Klon: ' . $verzeichnis;
        return $ergebnis;
    }

    $sperre = @fopen(dirname($verzeichnis) . '/.kommentator-deploy.lock', 'c');
    if ($sperre && !flock($sperre, LOCK_EX | LOCK_NB)) {
        $ergebnis['ausgabe'][] = 'Eine Auslieferung läuft bereits.';
        fclose($sperre);
        return $ergebnis;
    }

    $git = 'HOME=' . escapeshellarg($verzeichnis)
         . ' git -c safe.directory=' . escapeshellarg($verzeichnis)
         . ' -C ' . escapeshellarg($verzeichnis);

    $schritte = array(
        $git . ' fetch --prune --tags origin 2>&1',
        $git . ' reset --hard ' . escapeshellarg('origin/' . $zweig) . ' 2>&1',
    );
    $alleOk = true;
    foreach ($schritte as $befehl) {
        $zeilen = array();
        $code = 0;
        exec($befehl, $zeilen, $code);
        foreach ($zeilen as $z) {
            $ergebnis['ausgabe'][] = $z;
        }
        if ($code !== 0) {
            $alleOk = false;
            break;
        }
    }

    if ($alleOk) {
        $stand = array();
        exec($git . ' rev-parse --short HEAD 2>&1', $stand);
        $ergebnis['stand'] = isset($stand[0]) ? trim($stand[0]) : '';
    }
    $ergebnis['ok'] = $alleOk;

    if ($sperre) {
        flock($sperre, LOCK_UN);
        fclose($sperre);
    }
    return $ergebnis;
}

/**
 * Die ganze Entscheidungskette an einem Ort — damit sie prüfbar ist, ohne
 * eine Auslieferung auszulösen. Rückgabe: array(HTTP-Code, Text).
 */
function kommentator_deploy_behandeln($methode, $ereignis, $signatur, $rumpf, $inhaltstyp, $geheim, $ausfuehren = null) {
    if (strtoupper((string) $methode) !== 'POST') {
        return array(405, 'Nur POST.');
    }
    if (strlen((string) $rumpf) > 5 * 1024 * 1024) {
        return array(413, 'Rumpf zu gross.');
    }
    if (!kommentator_deploy_signatur_ok($rumpf, $signatur, $geheim)) {
        return array(401, 'Signatur ungueltig.');
    }
    // Erst NACH der Signaturprüfung wird der Inhalt überhaupt angesehen.
    if ($ereignis === 'ping') {
        return array(200, 'pong');
    }
    if ($ereignis !== 'push') {
        return array(202, 'Ereignis ignoriert: ' . (string) $ereignis);
    }
    $zweig = kommentator_deploy_zweig();
    $ref = kommentator_deploy_ref($rumpf, $inhaltstyp);
    if ($ref !== 'refs/heads/' . $zweig) {
        return array(202, 'Anderer Zweig, nichts zu tun: ' . ($ref === '' ? '?' : $ref));
    }
    if (!is_callable($ausfuehren)) {
        $ausfuehren = function ($verzeichnis, $zweig) {
            return kommentator_deploy_ausfuehren($verzeichnis, $zweig);
        };
    }
    $r = call_user_func($ausfuehren, kommentator_deploy_verzeichnis(), $zweig);
    if (empty($r['ok'])) {
        kommentator_deploy_protokoll('FEHLER  ' . implode(' | ', (array) $r['ausgabe']));
        return array(500, 'Auslieferung fehlgeschlagen.');
    }
    kommentator_deploy_protokoll('OK      ' . $zweig . ' -> ' . $r['stand']);
    return array(200, 'Ausgeliefert: ' . $zweig . ' -> ' . $r['stand']);
}

/* --- Ausführung nur im Web, nicht auf der Kommandozeile ------------------
   So kann der Test die Funktionen oben einzeln prüfen, ohne dass beim
   Einbinden der Datei etwas ausgeliefert wird. */
if (PHP_SAPI !== 'cli') {
    $rumpf = file_get_contents('php://input');
    list($code, $text) = kommentator_deploy_behandeln(
        isset($_SERVER['REQUEST_METHOD']) ? $_SERVER['REQUEST_METHOD'] : '',
        isset($_SERVER['HTTP_X_GITHUB_EVENT']) ? $_SERVER['HTTP_X_GITHUB_EVENT'] : '',
        isset($_SERVER['HTTP_X_HUB_SIGNATURE_256']) ? $_SERVER['HTTP_X_HUB_SIGNATURE_256'] : '',
        $rumpf,
        isset($_SERVER['CONTENT_TYPE']) ? $_SERVER['CONTENT_TYPE'] : 'application/json',
        kommentator_deploy_geheimnis()
    );
    http_response_code($code);
    header('Content-Type: text/plain; charset=utf-8');
    echo $text, "\n";
}
