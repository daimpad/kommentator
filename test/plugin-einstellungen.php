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
function register_setting($g, $n, $a = array()) {}
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
function esc_url_raw($u, $schemes = null) {
    $u = trim((string) $u);
    $p = parse_url($u);
    if (!$p || empty($p['scheme']) || empty($p['host'])) return '';
    if ($schemes && !in_array(strtolower($p['scheme']), $schemes, true)) return '';
    return $u;
}
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
pruef('Vorgabe: Frontend + Backend laden', kommentare_should_load() && kommentare_should_load_admin('index.php'));

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

// 3b) „Nur angemeldete Nutzer:innen" im Frontend
update_option('kommentare_optionen', array('frontend' => 1, 'nur_eingeloggt' => 1));
$GLOBALS['eingeloggt'] = false;
pruef('Nur-eingeloggt: Gast bekommt das Werkzeug nicht', kommentare_should_load() === false);
$GLOBALS['eingeloggt'] = true;
pruef('Nur-eingeloggt: angemeldet bekommt es', kommentare_should_load() === true);
$GLOBALS['eingeloggt'] = false;
update_option('kommentare_optionen', array('frontend' => 1, 'nur_eingeloggt' => 0));
pruef('Nur-eingeloggt: ohne Haken bleibt es öffentlich', kommentare_should_load() === true);
pruef('Nur-eingeloggt: Vorgabe ist aus (Verhalten bleibt wie bisher)',
    kommentare_standard_optionen()['nur_eingeloggt'] === 0);
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

echo "\n$ok/" . ($ok + $bad) . " Prüfungen bestanden\n";
exit($bad ? 1 : 0);
