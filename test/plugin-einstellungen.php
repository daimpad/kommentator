<?php
/* ============================================================================
   Test der WordPress-Plugin-Logik — ohne WordPress.
   ----------------------------------------------------------------------------
   Prüft die Einstellungsseite (Einstellungen → Kommentator): Vorgabewerte,
   Prüfung der Eingaben, Durchreichen in die init-Konfiguration, Vorrang der
   Filter und Maskierung im Formular.

   Ausführen:
     php test/plugin-einstellungen.php     (bzw. `npm test`, wenn PHP da ist)

   Unten steht eine Minimal-Attrappe der genutzten WordPress-Funktionen; sie
   bildet nur so viel nach, wie das Plugin tatsächlich anfasst.
   ========================================================================== */
define('ABSPATH', '/wp/');
$GLOBALS['opt'] = array();
$GLOBALS['filters'] = array();
$GLOBALS['errors'] = array();

function add_action($h, $c, $p = 10, $a = 1) {}
function add_filter($h, $c, $p = 10, $a = 1) { $GLOBALS['filters'][$h][] = $c; }
function apply_filters($h, $v) {
    $args = array_slice(func_get_args(), 1);
    foreach (($GLOBALS['filters'][$h] ?? []) as $c) { $v = call_user_func_array($c, $args); $args[0] = $v; }
    return $v;
}
function plugin_basename($f) { return 'kommentare-tool/kommentare-tool.php'; }
function plugin_dir_url($f) { return 'https://example.org/wp-content/plugins/kommentare-tool/'; }
function get_option($k, $d = false) { return $GLOBALS['opt'][$k] ?? $d; }
function update_option($k, $v) { $GLOBALS['opt'][$k] = $v; }
function delete_option($k) { unset($GLOBALS['opt'][$k]); }
function register_setting($g, $n, $a = array()) {}
function register_rest_route($ns, $route, $args = array()) { $GLOBALS['rest'][$ns . $route] = $args; }
function rest_url($p = '') { return 'https://example.org/wp-json/' . ltrim($p, '/'); }
function rest_ensure_response($d) { return new AttrappeAntwort($d); }
function wp_create_nonce($a = -1) { return 'nonce123'; }
function is_customize_preview() { return false; }
class AttrappeAntwort {
    public $daten; public $header = array();
    public function __construct($d) { $this->daten = $d; }
    public function header($k, $v) { $this->header[$k] = $v; }
}
function add_options_page() {}
function current_user_can($c) { return true; }
function is_user_logged_in() { return !empty($GLOBALS['eingeloggt']); }
function wp_get_current_user() { return (object) array('display_name' => 'Test'); }
function admin_url($p = '') { return 'https://example.org/wp-admin/' . $p; }
function esc_url($u) { return $u; }
function esc_attr($s) { return htmlspecialchars((string) $s, ENT_QUOTES); }
function esc_html($s) { return htmlspecialchars((string) $s, ENT_QUOTES); }
function esc_html__($s, $d = '') { return $s; }
function esc_html_e($s, $d = '') { echo $s; }
function __($s, $d = '') { return $s; }
function checked($a, $b = true, $echo = true) { if ($a == $b) echo " checked='checked'"; }
function submit_button() {}
function settings_fields($g) {}
function add_settings_error($s, $c, $m, $t = 'error') { $GLOBALS['errors'][] = $c; }
function sanitize_email($m) { $m = trim((string) $m); return filter_var($m, FILTER_VALIDATE_EMAIL) ? $m : ''; }
function sanitize_text_field($s) { return trim(strip_tags((string) $s)); }
/* Naeher am Core: esc_url_raw ist ein BEREINIGER, kein Validator.
   - schemalose Adressen bekommen http:// vorangestellt
   - protokollrelative (//host/x) bleiben unveraendert stehen
   - nur ein VORHANDENES, nicht erlaubtes Schema fuehrt zu ''
   Genau deshalb prueft das Plugin zusaetzlich mit wp_parse_url(). */
function esc_url_raw($u, $schemes = null) {
    $u = str_replace(' ', '%20', ltrim((string) $u));
    if ($u === '') return '';
    if (preg_match('#^([a-z][a-z0-9+.-]*):#i', $u, $m)) {
        if ($schemes && !in_array(strtolower($m[1]), $schemes, true)) return '';
        return $u;
    }
    if (substr($u, 0, 2) === '//' || $u[0] === '/' || $u[0] === '#' || $u[0] === '?') return $u;
    return 'http://' . $u;
}
function wp_parse_url($u, $c = -1) { $p = parse_url($u); return $p === false ? array() : $p; }
function wp_json_encode($v) { return json_encode($v); }
function wp_enqueue_style() {}
function wp_enqueue_script() {}
function wp_add_inline_script() {}

require __DIR__ . "/../wordpress/kommentare-tool/kommentare-tool.php";

$ok = 0; $bad = 0;
function pruef($name, $bedingung) {
    global $ok, $bad;
    if ($bedingung) { $ok++; echo "PASS — $name\n"; }
    else { $bad++; echo "FAIL — $name\n"; }
}

// 1) Vorgaben ohne gespeicherte Option
$c = kommentare_build_config(false);
pruef('Vorgabe: webhook leer', $c['webhook'] === '');
pruef('Vorgabe: webhookAuto an', $c['webhookAuto'] === true);
pruef('Vorgabe: container body', $c['container'] === 'body');
// Vorgabe: Backend immer, Frontend nur für angemeldete Nutzer:innen
pruef('Vorgabe: Backend lädt', kommentare_should_load_admin('index.php') === true);
$GLOBALS['eingeloggt'] = true;
pruef('Vorgabe: Frontend lädt für Angemeldete', kommentare_should_load() === true);
$GLOBALS['eingeloggt'] = false;
pruef('Vorgabe: Frontend lädt NICHT für Gäste', kommentare_should_load() === false);

// 2) Prüfung der Eingaben
$s = kommentare_optionen_pruefen(array(
    'webhook' => 'https://script.google.com/macros/s/ABC/exec',
    'webhook_auto' => '1', 'email' => 'kontakt@nozilla.de',
    'container' => '.entry-content', 'frontend' => '1',
));
pruef('Prüfung: https-Adresse übernommen', $s['webhook'] === 'https://script.google.com/macros/s/ABC/exec');
pruef('Prüfung: E-Mail übernommen', $s['email'] === 'kontakt@nozilla.de');
pruef('Prüfung: Container übernommen', $s['container'] === '.entry-content');
pruef('Prüfung: nicht angehaktes Backend wird 0', $s['backend'] === 0);

// Adressen, die esc_url_raw allein NICHT abweist -> wp_parse_url-Nachpruefung
foreach (array('//fremd.test/exec', '/nur/pfad', '#anker', 'ohne-schema.test/exec') as $u) {
    $r = kommentare_optionen_pruefen(array('webhook' => $u));
    if ($u === 'ohne-schema.test/exec') {
        pruef("Adresse '$u' wird zu http:// ergaenzt", $r['webhook'] === 'http://ohne-schema.test/exec');
    } else {
        pruef("Adresse '$u' wird abgelehnt", $r['webhook'] === '');
    }
}
foreach (array('ftp://x/y', 'data:text/html,x') as $u) {
    $r = kommentare_optionen_pruefen(array('webhook' => $u));
    pruef("Fremdes Schema '$u' wird abgelehnt", $r['webhook'] === '');
}

$GLOBALS['errors'] = array();
$b = kommentare_optionen_pruefen(array('webhook' => 'javascript:alert(1)', 'email' => 'kein-mail'));
pruef('Prüfung: javascript: wird verworfen', $b['webhook'] === '');
pruef('Prüfung: ungültige E-Mail wird verworfen', $b['email'] === '');
pruef('Prüfung: beide Fehler werden gemeldet', count($GLOBALS['errors']) === 2);
pruef('Prüfung: leerer Container fällt auf body zurück', $b['container'] === 'body');

// 3) Gespeicherte Option fliesst in die Konfiguration
update_option('kommentare_optionen', array(
    'webhook' => 'https://beispiel.test/exec', 'webhook_auto' => 0,
    'email' => 'a@b.de', 'container' => '.inhalt', 'frontend' => 0, 'backend' => 1,
));
$c = kommentare_build_config(false);
pruef('Option: webhook wirkt', $c['webhook'] === 'https://beispiel.test/exec');
pruef('Option: webhookAuto aus wirkt', $c['webhookAuto'] === false);
pruef('Option: email wirkt', $c['email'] === 'a@b.de');
pruef('Option: container wirkt', $c['container'] === '.inhalt');
pruef('Option: Frontend aus wirkt', kommentare_should_load() === false);
pruef('Option: Backend an wirkt', kommentare_should_load_admin('index.php') === true);

// 3a2) Verschachtelte Formularfelder duerfen nicht fatal werden
$GLOBALS['errors'] = array();
$arr = kommentare_optionen_pruefen(array(
    'webhook' => array('x'), 'email' => array('y'), 'container' => array('z'),
));
pruef('Array statt String: webhook leer', $arr['webhook'] === '');
pruef('Array statt String: email leer', $arr['email'] === '');
pruef('Array statt String: container faellt auf body zurueck', $arr['container'] === 'body');

// 3a3) Ungueltige Selektoren werden abgelehnt und gemeldet
foreach (array('.a,', ',', '.a[b', '.a)', str_repeat('x', 250)) as $sel) {
    $r = kommentare_optionen_pruefen(array('container' => $sel));
    pruef("Selektor '" . substr($sel, 0, 12) . "' wird abgelehnt", $r['container'] === 'body');
}
foreach (array('body', '.entry-content', '#main > .inhalt', '.a, .b', '[data-x]') as $sel) {
    $r = kommentare_optionen_pruefen(array('container' => $sel));
    pruef("Selektor '$sel' wird uebernommen", $r['container'] === $sel);
}

// 3b) „Nur angemeldete Nutzer:innen" im Frontend
update_option('kommentare_optionen', array('frontend' => 1, 'nur_eingeloggt' => 1));
$GLOBALS['eingeloggt'] = false;
pruef('Nur-eingeloggt: Gast bekommt das Werkzeug nicht', kommentare_should_load() === false);
$GLOBALS['eingeloggt'] = true;
pruef('Nur-eingeloggt: angemeldet bekommt es', kommentare_should_load() === true);
$GLOBALS['eingeloggt'] = false;
update_option('kommentare_optionen', array('frontend' => 1, 'nur_eingeloggt' => 0));
pruef('Nur-eingeloggt: ohne Haken bleibt es öffentlich', kommentare_should_load() === true);
pruef('Nur-eingeloggt: Vorgabe ist AN (sichere Voreinstellung)',
    kommentare_standard_optionen()['nur_eingeloggt'] === 1);
// Frische Installation ohne gespeicherte Optionen: Gast bleibt draußen
delete_option('kommentare_optionen');
$GLOBALS['eingeloggt'] = false;
pruef('Nur-eingeloggt: frische Installation schließt Gäste aus',
    kommentare_should_load() === false);
$GLOBALS['eingeloggt'] = true;
pruef('Nur-eingeloggt: frische Installation lädt für Angemeldete',
    kommentare_should_load() === true);
$GLOBALS['eingeloggt'] = false;
// Wer den Haken bewusst entfernt hat, behält seine Einstellung
update_option('kommentare_optionen', array('frontend' => 1, 'nur_eingeloggt' => 0));
pruef('Nur-eingeloggt: bewusst abgewählt bleibt abgewählt',
    kommentare_should_load() === true);
$s2 = kommentare_optionen_pruefen(array('nur_eingeloggt' => '1'));
pruef('Nur-eingeloggt: Haken wird gespeichert', $s2['nur_eingeloggt'] === 1);
update_option('kommentare_optionen', array(
    'webhook' => 'https://beispiel.test/exec', 'webhook_auto' => 0,
    'email' => 'a@b.de', 'container' => '.inhalt', 'frontend' => 0, 'backend' => 1,
));

// 4) Filter sticht die gespeicherte Option
add_filter('kommentare_webhook', function () { return 'https://filter.test/exec'; });
add_filter('kommentare_should_load', function () { return true; });
$c = kommentare_build_config(false);
pruef('Filter sticht Option (webhook)', $c['webhook'] === 'https://filter.test/exec');
pruef('Filter sticht Option (should_load)', kommentare_should_load() === true);

// 5) Einstellungsseite rendert ohne Fehler und maskiert Werte
update_option('kommentare_optionen', array('webhook' => 'https://x.test/"><script>alert(1)</script>'));
ob_start(); kommentare_einstellungsseite(); $html = ob_get_clean();
pruef('Seite: rendert Formular', strpos($html, 'kommentare_optionen[webhook]') !== false);
pruef('Seite: Wert ist maskiert', strpos($html, '<script>alert(1)') === false);


// --- Nachladen: was steht im HTML, was kommt ueber den Endpunkt? ---
$GLOBALS['filters'] = array();   // Filter des vorigen Abschnitts wirken sonst nach
update_option('kommentare_optionen', array(
    'webhook' => 'https://script.google.com/macros/s/GEHEIM/exec',
    'webhook_token' => 'losungswort', 'email' => 'a@b.de',
    'frontend' => 1, 'nur_eingeloggt' => 1,
));
$GLOBALS['eingeloggt'] = true;

$config = kommentare_build_config(false);
$persoenlich = array();
foreach (kommentare_persoenliche_schluessel() as $k) {
    if (array_key_exists($k, $config)) { $persoenlich[$k] = $config[$k]; unset($config[$k]); }
}
$config['autor'] = 'Gast';
$html = wp_json_encode($config);

pruef('Nachladen: Sammelstellen-Adresse steht NICHT im HTML', strpos($html, 'GEHEIM') === false);
pruef('Nachladen: Geheimwort steht NICHT im HTML', strpos($html, 'losungswort') === false);
pruef('Nachladen: E-Mail steht NICHT im HTML', strpos($html, 'a@b.de') === false);
pruef('Nachladen: Autorname steht NICHT im HTML', strpos($html, '"Test"') === false);
pruef('Nachladen: HTML enthaelt weiterhin den Container', strpos($html, '"container"') !== false);
pruef('Nachladen: HTML faellt auf Gast zurueck', strpos($html, '"autor":"Gast"') !== false);

$antwort = kommentare_rest_konfiguration();
pruef('Endpunkt: liefert Adresse', $antwort->daten['webhook'] === 'https://script.google.com/macros/s/GEHEIM/exec');
pruef('Endpunkt: liefert Geheimwort', $antwort->daten['webhookToken'] === 'losungswort');
pruef('Endpunkt: liefert Autorname', $antwort->daten['autor'] === 'Test');
pruef('Endpunkt: liefert E-Mail', $antwort->daten['email'] === 'a@b.de');
pruef('Endpunkt: nur persoenliche Werte', array_keys($antwort->daten) === kommentare_persoenliche_schluessel());
pruef('Endpunkt: verbietet Zwischenspeichern',
    isset($antwort->header['Cache-Control']) && strpos($antwort->header['Cache-Control'], 'no-store') !== false);

$GLOBALS['eingeloggt'] = true;
pruef('Endpunkt: angemeldet erlaubt', kommentare_rest_erlaubt() === true);
$GLOBALS['eingeloggt'] = false;
pruef('Endpunkt: Gast abgewiesen, wenn nur angemeldet', kommentare_rest_erlaubt() === false);
update_option('kommentare_optionen', array('frontend' => 1, 'nur_eingeloggt' => 0));
pruef('Endpunkt: Gast erlaubt, wenn oeffentlich', kommentare_rest_erlaubt() === true);
update_option('kommentare_optionen', array('frontend' => 0, 'nur_eingeloggt' => 0));
pruef('Endpunkt: Gast abgewiesen, wenn Frontend aus', kommentare_rest_erlaubt() === false);

$t = kommentare_optionen_pruefen(array('webhook_token' => '  mein Wort  '));
pruef('Geheimwort: wird getrimmt gespeichert', $t['webhook_token'] === 'mein Wort');
$t = kommentare_optionen_pruefen(array('webhook_token' => str_repeat('x', 400)));
pruef('Geheimwort: auf 200 Zeichen begrenzt', strlen($t['webhook_token']) === 200);
$t = kommentare_optionen_pruefen(array('webhook_token' => array('x')));
pruef('Geheimwort: Array wird verworfen', $t['webhook_token'] === '');

echo "\n$ok/" . ($ok + $bad) . " Prüfungen bestanden\n";
exit($bad ? 1 : 0);
