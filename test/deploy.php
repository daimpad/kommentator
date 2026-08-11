<?php
/* ============================================================================
   Test des Auslieferungs-Endpunkts (deploy.php) — ohne Webserver und ohne Git.
   ----------------------------------------------------------------------------
   Geprüft wird die Entscheidungskette: Methode, Signatur, Ereignis, Zweig.
   Der eigentliche Git-Aufruf wird untergeschoben, es wird also nichts geholt
   und nichts zurückgesetzt.

   Ausführen:
     php test/deploy.php     (bzw. `npm test`, wenn PHP da ist)
   ========================================================================== */

require __DIR__ . '/../deploy.php';   // PHP_SAPI === 'cli' -> nichts wird ausgeführt

$ok = 0; $bad = 0;
function pruef($name, $bedingung) {
    global $ok, $bad;
    if ($bedingung) { $ok++; echo "PASS — $name\n"; }
    else { $bad++; echo "FAIL — $name\n"; }
}

$geheim = 'geheimwort-fuer-den-test';
$rumpf  = json_encode(array('ref' => 'refs/heads/main', 'after' => 'abc123'));
$sig    = 'sha256=' . hash_hmac('sha256', $rumpf, $geheim);

/* Statt Git aufzurufen, merken wir uns nur, DASS ausgeliefert worden wäre. */
$GLOBALS['ausgeliefert'] = 0;
$attrappe = function ($verzeichnis, $zweig) {
    $GLOBALS['ausgeliefert']++;
    return array('ok' => true, 'ausgabe' => array(), 'stand' => 'abc1234');
};
$scheitert = function ($verzeichnis, $zweig) {
    return array('ok' => false, 'ausgabe' => array('fatal: kaputt'), 'stand' => '');
};
function code($r) { return $r[0]; }

/* --- Signaturprüfung ---------------------------------------------------- */
pruef('Signatur: gueltige Signatur wird angenommen',
    kommentator_deploy_signatur_ok($rumpf, $sig, $geheim) === true);
pruef('Signatur: falsches Geheimwort wird abgewiesen',
    kommentator_deploy_signatur_ok($rumpf, $sig, 'anderes') === false);
pruef('Signatur: veraenderter Rumpf wird abgewiesen',
    kommentator_deploy_signatur_ok($rumpf . ' ', $sig, $geheim) === false);
pruef('Signatur: fehlende Kopfzeile wird abgewiesen',
    kommentator_deploy_signatur_ok($rumpf, null, $geheim) === false);
pruef('Signatur: leere Kopfzeile wird abgewiesen',
    kommentator_deploy_signatur_ok($rumpf, '', $geheim) === false);
pruef('Signatur: sha1 aus alter Zeit wird abgewiesen',
    kommentator_deploy_signatur_ok($rumpf, 'sha1=' . hash_hmac('sha1', $rumpf, $geheim), $geheim) === false);
pruef('Signatur: nackter Hash ohne Praefix wird abgewiesen',
    kommentator_deploy_signatur_ok($rumpf, hash_hmac('sha256', $rumpf, $geheim), $geheim) === false);
// Ohne eingerichtetes Geheimwort darf NICHTS durchgehen — auch keine
// Anfrage, die eine leere Signatur ueber ein leeres Geheimwort rechnet.
pruef('Signatur: ohne Geheimwort geht nichts durch',
    kommentator_deploy_signatur_ok($rumpf, 'sha256=' . hash_hmac('sha256', $rumpf, ''), '') === false);

/* --- Entscheidungskette -------------------------------------------------- */
$GLOBALS['ausgeliefert'] = 0;
$r = kommentator_deploy_behandeln('POST', 'push', $sig, $rumpf, 'application/json', $geheim, $attrappe);
pruef('Ablauf: gueltiger Push liefert aus', code($r) === 200 && $GLOBALS['ausgeliefert'] === 1);
pruef('Ablauf: Antwort nennt den neuen Stand', strpos($r[1], 'abc1234') !== false);

$GLOBALS['ausgeliefert'] = 0;
$r = kommentator_deploy_behandeln('GET', 'push', $sig, $rumpf, 'application/json', $geheim, $attrappe);
pruef('Ablauf: GET wird abgewiesen', code($r) === 405 && $GLOBALS['ausgeliefert'] === 0);

$r = kommentator_deploy_behandeln('POST', 'push', 'sha256=falsch', $rumpf, 'application/json', $geheim, $attrappe);
pruef('Ablauf: falsche Signatur liefert nicht aus', code($r) === 401 && $GLOBALS['ausgeliefert'] === 0);

$r = kommentator_deploy_behandeln('POST', 'push', $sig, $rumpf, 'application/json', '', $attrappe);
pruef('Ablauf: ohne eingerichtetes Geheimwort passiert nichts',
    code($r) === 401 && $GLOBALS['ausgeliefert'] === 0);

// ping: GitHub schickt das beim Anlegen des Hakens — muss 200 geben, sonst
// zeigt GitHub den Haken als kaputt an. Aber ausliefern darf es nicht.
$pingRumpf = json_encode(array('zen' => 'Non-blocking is better than blocking.'));
$pingSig   = 'sha256=' . hash_hmac('sha256', $pingRumpf, $geheim);
$r = kommentator_deploy_behandeln('POST', 'ping', $pingSig, $pingRumpf, 'application/json', $geheim, $attrappe);
pruef('Ablauf: ping wird bestaetigt, liefert aber nicht aus',
    code($r) === 200 && $r[1] === 'pong' && $GLOBALS['ausgeliefert'] === 0);

// Ein ping OHNE gueltige Signatur darf auch kein pong bekommen.
$r = kommentator_deploy_behandeln('POST', 'ping', 'sha256=falsch', $pingRumpf, 'application/json', $geheim, $attrappe);
pruef('Ablauf: ping ohne Signatur wird abgewiesen', code($r) === 401);

$fremdRumpf = json_encode(array('ref' => 'refs/heads/feature-xyz'));
$fremdSig   = 'sha256=' . hash_hmac('sha256', $fremdRumpf, $geheim);
$r = kommentator_deploy_behandeln('POST', 'push', $fremdSig, $fremdRumpf, 'application/json', $geheim, $attrappe);
pruef('Ablauf: fremder Zweig liefert nicht aus', code($r) === 202 && $GLOBALS['ausgeliefert'] === 0);

// Ein Tag-Push (refs/tags/wp-v1.17.0) ist kein Zweig — die Releases des
// Plugins duerfen die Seite nicht anfassen.
$tagRumpf = json_encode(array('ref' => 'refs/tags/wp-v1.17.0'));
$tagSig   = 'sha256=' . hash_hmac('sha256', $tagRumpf, $geheim);
$r = kommentator_deploy_behandeln('POST', 'push', $tagSig, $tagRumpf, 'application/json', $geheim, $attrappe);
pruef('Ablauf: Tag-Push liefert nicht aus', code($r) === 202 && $GLOBALS['ausgeliefert'] === 0);

$r = kommentator_deploy_behandeln('POST', 'issues', $sig, $rumpf, 'application/json', $geheim, $attrappe);
pruef('Ablauf: anderes Ereignis liefert nicht aus', code($r) === 202 && $GLOBALS['ausgeliefert'] === 0);

$r = kommentator_deploy_behandeln('POST', 'push', $sig, $rumpf, 'application/json', $geheim, $scheitert);
pruef('Ablauf: gescheiterte Auslieferung meldet 500', code($r) === 500);

$gross = str_repeat('x', 6 * 1024 * 1024);
$r = kommentator_deploy_behandeln('POST', 'push', 'sha256=egal', $gross, 'application/json', $geheim, $attrappe);
pruef('Ablauf: uebergrosser Rumpf wird vorher abgewiesen', code($r) === 413);

/* --- Formular-Zustellung (Content type: form) ---------------------------- */
$formRumpf = 'payload=' . urlencode($rumpf);
$formSig   = 'sha256=' . hash_hmac('sha256', $formRumpf, $geheim);
$GLOBALS['ausgeliefert'] = 0;
$r = kommentator_deploy_behandeln('POST', 'push', $formSig, $formRumpf,
    'application/x-www-form-urlencoded', $geheim, $attrappe);
pruef('Formular: payload= wird gelesen und ausgeliefert',
    code($r) === 200 && $GLOBALS['ausgeliefert'] === 1);

/* --- Ref-Auswertung ------------------------------------------------------ */
pruef('Ref: JSON wird gelesen',
    kommentator_deploy_ref($rumpf) === 'refs/heads/main');
pruef('Ref: kaputtes JSON gibt leer', kommentator_deploy_ref('{kaputt') === '');
pruef('Ref: JSON ohne ref gibt leer', kommentator_deploy_ref('{"a":1}') === '');
pruef('Ref: Zahl statt Zeichenkette gibt leer', kommentator_deploy_ref('{"ref":42}') === '');

/* --- Kein Geheimnis in der ausgelieferten Datei -------------------------- */
$quelle = file_get_contents(__DIR__ . '/../deploy.php');
pruef('Quelle: enthaelt kein fest verdrahtetes Geheimwort',
    strpos($quelle, 'KOMMENTATOR_DEPLOY_SECRET') !== false
    && !preg_match('#\$geheim\s*=\s*[\'"][^\'"]{8,}[\'"]#', $quelle));

echo "\n$ok/" . ($ok + $bad) . " Prüfungen bestanden\n";
exit($bad ? 1 : 0);
