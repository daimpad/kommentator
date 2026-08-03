# Der Kommentator — was er ist und wofür er taugt

Eine ausführliche Einordnung für alle, die vor der Frage stehen, ob dieses
Werkzeug zu ihrer Arbeit passt. Bewusst nicht-technisch.

Wer direkt loslegen will: **[Tutorial](TUTORIAL.md)**.
Wer die Schnittstellen sucht: **[Technische Dokumentation](TECHNISCHE_DOKUMENTATION.md)**.
Wer erst schauen will: **[Live-Demo](https://daimpad.github.io/kommentator/)**.

---

## Inhalt

1. [In einem Satz](#in-einem-satz)
2. [Das Problem](#das-problem)
3. [Der Ansatz](#der-ansatz)
4. [Was er kann](#was-er-kann)
5. [Wie eine Runde abläuft](#wie-eine-runde-abläuft)
6. [Wofür man ihn einsetzt](#wofür-man-ihn-einsetzt)
7. [Wofür er nicht gedacht ist](#wofür-er-nicht-gedacht-ist)
8. [Wer sich damit auseinandersetzen sollte](#wer-sich-damit-auseinandersetzen-sollte)
9. [Im Vergleich](#im-vergleich)
10. [Entscheidungshilfe](#entscheidungshilfe)
11. [Was es kostet](#was-es-kostet)

---

## In einem Satz

Der Kommentator legt sich als **Klebezettel-Schicht über eine bestehende
Webseite**: Textstellen markieren, Elemente anklicken, Punkte anheften — jeweils
mit einem Kommentar daran, ohne dass an der Seite selbst irgendetwas geändert
wird.

## Das Problem

Rückmeldungen zu einer Webseite sind notorisch mühsam einzusammeln. Sie kommen

- als E-Mail-Fließtext: *„die Überschrift auf der zweiten Seite unten, das
  dritte Wort — das passt so nicht"*,
- als Word-Datei mit eingeklebten Screenshots und roten Pfeilen,
- als Telefonnotiz, die niemand mehr zuordnen kann,
- oder gar nicht, weil der Aufwand zu groß war.

Jede einzelne muss anschließend wieder **auf der Seite lokalisiert** werden. Bei
fünf Beteiligten liegen fünf Dateien in fünf Formaten vor, mit Dopplungen und
Widersprüchen, und niemand weiß, ob eine Anmerkung schon eingearbeitet ist.

Das eigentliche Problem ist nicht das Schreiben der Rückmeldung. Es ist der
**Verlust des Ortsbezugs** zwischen „gesehen" und „gemeldet".

## Der Ansatz

Die verbreiteten Lösungen dafür heißen Figma-Kommentare, Usersnap, Marker.io,
Pastel. Sie sind leistungsfähig — und gebunden an ein Konto, ein Abo, einen
fremden Server und eine Datenschutzprüfung. Für eine einmalige Abnahmerunde mit
drei Personen ist das viel Apparat.

Der Kommentator geht den anderen Weg: **zwei Dateien, die man neben die Seite
legt.** Eine CSS-Datei, eine JS-Datei, drei Zeilen Einbindung. Kein Konto, kein
Server, kein Abo, kein Build-Schritt, keine Abhängigkeit zu irgendetwas.

Die Rückmeldung entsteht dort, wo sie hingehört: an der Stelle selbst.

## Was er kann

### Drei Arten zu kommentieren

| Art | Wie | Typischer Kommentar |
|---|---|---|
| **Text** | Textstelle mit Maus oder Finger markieren | „Dieser Satz ist missverständlich" |
| **Element** | Box, Bild oder Container anklicken | „Diese Kachel wirkt verloren" |
| **Punkt** | Nadel an eine beliebige Stelle heften | „Hier fehlt ein Abstand" |

Textmarkierungen laufen über Absatz- und Elementgrenzen hinweg — auch quer durch
Fettungen, Links und verschachtelte Auszeichnungen. Element- und Punkt-Kommentare
erreichen das, was gar keinen Text hat: Bilder, Icons, Leerräume, Abstände.

### Kommentare finden ihre Stelle wieder

Das ist der technisch anspruchsvollste Teil und der Grund, warum das Werkzeug
mehr ist als ein Notizfeld.

Jede Markierung speichert nicht nur eine Position, sondern auch den **exakten
Wortlaut plus etwas Kontext davor und danach**. Beim Wiedereinlesen wird zuerst
die Position probiert; passt der Text dort nicht mehr, sucht das Werkzeug den
Wortlaut im ganzen Dokument — und wenn der mehrfach vorkommt, entscheidet der
gespeicherte Kontext, welche Fundstelle gemeint war.

Element- und Punkt-Kommentare verankern zusätzlich **relativ**: gespeichert wird
der Pfad zum Element und die Position *darin* in Prozent. Ein Punkt bei „30 %
von links, 60 % von oben" sitzt nach einem Umbruch auf dem Handy immer noch an
derselben Stelle desselben Elements — nicht an einer absoluten Pixelkoordinate,
die dann irgendwo im Nirgendwo läge.

Das Datenmodell folgt dem **W3C-Web-Annotation-Standard**. Die Exporte sind also
kein Eigenformat, das nur dieses eine Werkzeug versteht.

### Zwei Wege, Rückmeldungen zusammenzuführen

**Ohne alles.** Jede:r lädt die eigenen Kommentare als JSON-Datei herunter, du
sammelst die Dateien ein und liest sie gemeinsam wieder ein. Alle Notizen
erscheinen nebeneinander mit Namen, doppelte werden erkannt und übersprungen.
Umständlicher, aber vollständig unabhängig — es verlässt buchstäblich nichts den
Browser.

**Mit einer Sammelstelle.** Du hinterlegst eine Adresse — typischerweise ein
Google Sheet hinter einem kleinen Apps-Script, das in zehn Minuten steht. Dann
meldet sich jeder Kommentar automatisch dorthin: Zeitpunkt, Seiten-URL,
Seitentitel, Autor:in, Art, markierte Stelle, Kommentartext. Viele
Kommentierende auf vielen Seiten, **eine Tabelle**. Immer noch ohne Datenbank
und ohne eigenen Server.

Der zweite Weg ist **opt-in**. Ohne Adresse verhält sich das Werkzeug exakt wie
zuvor: nichts geht raus.

### Herausgeben

JSON zum Wiedereinlesen · Markdown zum Lesen und Weiterreichen · PDF über den
Systemdruck, wobei die Seite *mit* den Notizen gedruckt wird · E-Mail-Entwurf ·
wahlweise direkt zur Sammelstelle.

### Nebenbei

Hell- und Dunkelmodus, der dem System folgt. Ziehbare Notizspalte. Alles hinter
einem Knopf unten rechts, damit die Seite frei bleibt. Vollständig über
CSS-Variablen umfärbbar. Deutsche Texte an einer Stelle gebündelt und pro
Einbindung überschreibbar. Tastaturbedienung mit sichtbarem Fokus und Fokusfalle
in Dialogen, ARIA an Markierungen und Notizen, `prefers-reduced-motion`.
Funktioniert bis hinunter zu 380 Pixel Breite.

## Wie eine Runde abläuft

Ein konkreter Ablauf, damit das Abstrakte greifbar wird:

1. **Du stellst die Seite bereit** — die zu prüfende Seite mit den beiden
   eingebundenen Dateien. Auf einem Testserver, per GitHub Pages, oder in
   WordPress als Plugin auf der echten Seite.
2. **Du schickst den Link** an die drei Beteiligten. Kein Konto, keine
   Einladung, keine Registrierung.
3. **Jede:r trägt beim Öffnen den eigenen Namen ein** — nur zur Zuordnung, das
   ist kein Login.
4. **Alle kommentieren direkt auf der Seite.** Was auffällt, wird markiert und
   beschriftet; die Notizen sammeln sich rechts.
5. **Am Ende:** Entweder lädt jede:r eine Datei herunter und schickt sie dir —
   oder alles ist längst in deiner Tabelle gelandet, weil du eine Sammelstelle
   eingerichtet hast.
6. **Du liest die Dateien gemeinsam ein** und siehst alle Rückmeldungen
   nebeneinander an ihren jeweiligen Stellen. Oder du sortierst in der Tabelle
   nach Seite, Person oder Zeitpunkt.

## Wofür man ihn einsetzt

**Abnahmerunden.** Der klassische Fall: Entwurf steht, drei Leute sollen
draufschauen. Jede:r markiert direkt, was auffällt, statt es zu beschreiben.

**Redaktionelle Durchsicht.** Lange Texte gegenlesen, ohne Änderungen im
Original vorzunehmen — Vorschläge stehen daneben statt drin, das Original bleibt
unangetastet.

**Barrierefreiheits- und Qualitätsprüfungen.** Befunde sitzen dort, wo sie
auftreten, statt in einer Tabelle mit Screenshot-Verweisen und
Koordinatenangaben.

**Lehre und Schulung.** Ein Text wird gemeinsam annotiert; die Exporte lassen
sich einsammeln, vergleichen und auswerten.

**Nutzertests.** Testpersonen heften Anmerkungen an genau die Stellen, die sie
irritieren — näher an der tatsächlichen Wahrnehmung als jedes Protokoll.

**Interne Abstimmung in WordPress.** Mit dem Plugin ist die ganze Seite
kommentierbar — im Frontend *und* im Backend, also auch Admin-Menü, Editor und
Einstellungsseiten. Nützlich, wenn nicht die Inhalte, sondern die Redaktions-
oberfläche selbst zur Diskussion steht.

**Dokumentation und Handbücher.** Wo klemmt die Anleitung? Leser:innen markieren
die Stelle, statt Kapitelnummern zu zitieren.

## Wofür er nicht gedacht ist

Ehrlichkeit spart Enttäuschung. Der Kommentator ist ausdrücklich **nicht**:

- **Ein Echtzeit-Werkzeug.** Niemand sieht die Kommentare der anderen live
  auftauchen. Der Austausch ist bewusst zeitversetzt — das ist der Preis dafür,
  dass kein Server mitläuft.
- **Ein Ticketsystem.** Kein Status, keine Zuweisung, keine Erledigt-Häkchen,
  keine Benachrichtigungen, keine Antworten auf Kommentare.
- **Ein Zugriffsschutz.** Das Namensfeld ordnet zu, es schützt nicht. Wer
  wirklich abschotten will, regelt das auf Server-Ebene: HTTP Basic Auth per
  `.htaccess` oder WordPress-Login.
- **Ein Speicher.** Ohne Sammelstelle ist der Zustand nach dem Neuladen weg —
  es gibt bewusst kein `localStorage`. Erst exportieren, dann schließen. Wer das
  vergisst, verliert seine Notizen.
- **Geeignet für stark wechselnde Inhalte.** Ändert sich der Text zwischen zwei
  Runden, verlieren einzelne Markierungen ihren Halt und verschwinden still.
- **Ein Analysewerkzeug.** Es zählt nichts, wertet nichts aus, erstellt keine
  Berichte. Die Tabelle ist eine Tabelle.

## Wer sich damit auseinandersetzen sollte

**Agenturen und Freiberufler:innen**, die Entwürfe abnehmen lassen — der
häufigste Fall. Kundin bekommt einen Link, kommentiert direkt, schickt eine
Datei zurück oder alles läuft in die Tabelle. Kein „bitte legen Sie sich hier
ein Konto an".

**Redaktionen und Fachbereiche**, die Texte im Web gegenlesen, ohne ins CMS zu
greifen oder Änderungen zu riskieren.

**Menschen mit Datenschutzauflagen.** Öffentliche Verwaltung, Bildung,
Gesundheitswesen, Betriebsräte, Anwaltskanzleien: Es gibt keinen
Auftragsverarbeiter, keine Drittlandübermittlung, keine Cookies, kein Tracking,
keine Einwilligungsbanner. Ohne Sammelstelle verlässt kein Byte den Browser; mit
Sammelstelle geht es genau dorthin, wo du es hinlegst — auch in ein eigenes
Postfach oder einen eigenen Endpunkt. Gemeldet wird **nie eine IP-Adresse**,
sondern eine anonyme Sitzungskennung, die beim Schließen des Tabs verfällt. Ist
die Sammelstelle aktiv, benennt der Hilfetext den Versand den Kommentierenden
gegenüber ausdrücklich.

**WordPress-Betreiber:innen**, die Rückmeldungen zu Seiten sammeln wollen.
Plugin installieren, aktivieren, fertig; alles Weitere unter *Einstellungen →
Kommentator*, ohne eine Zeile Code. Im Auslieferungszustand sehen nur
angemeldete Nutzer:innen das Werkzeug — wer offene Rückmeldungen will, hakt das
bewusst ab.

**Entwickler:innen**, die so etwas in ein eigenes Produkt einbauen. Eine
Funktion, ein gutes Dutzend Optionen, Callbacks bei jeder Änderung, W3C-nahes
Datenmodell, MIT-Lizenz. Kein Framework, keine Abhängigkeit, kein Build —
`kommentare.js` ist bewusst ES5-tauglich und läuft ohne Transpiler.

**Wer sich Werkzeuge dieser Art fachlich anschauen will.** Der Quelltext ist
eine kompakte, kommentierte Umsetzung von DOM-Ranges, Text-Wiederverankerung mit
Kontext-Disambiguierung und Overlay-Positionierung — mit Akzeptanztests, die die
kniffligen Fälle festhalten.

## Im Vergleich

| | Kommentator | Figma/Usersnap/Marker.io | E-Mail & Screenshots |
|---|---|---|---|
| Konto nötig | nein | ja | nein |
| Laufende Kosten | keine | Abo | keine |
| Ortsbezug erhalten | ja | ja | nein |
| Echtzeit | nein | ja | nein |
| Status/Zuweisung | nein | ja | nein |
| Daten bleiben bei dir | ja | nein | ja |
| Einrichtung | 3 Zeilen | Konto + Einbindung | keine |
| Für Externe zumutbar | ja | Konto nötig | ja |

Die Zeile, auf die es ankommt, ist die vorletzte: **Ortsbezug erhalten und
trotzdem ohne Konto.** Genau in dieser Lücke sitzt der Kommentator.

## Entscheidungshilfe

**Nimm den Kommentator, wenn** du eine überschaubare Runde Rückmeldungen zu
einer Webseite brauchst, die Beteiligten sich nirgends anmelden sollen, und die
Daten aus rechtlichen oder praktischen Gründen bei dir bleiben müssen.

**Nimm etwas anderes, wenn** mehrere Personen gleichzeitig dieselben Kommentare
sehen sollen, du Status und Zuweisungen brauchst, oder die Rückmeldungen in
einen bestehenden Ticket-Workflow fließen müssen.

**Nimm beides, wenn** die externe Abnahme über den Kommentator läuft und die
daraus entstehenden Aufgaben anschließend im eigenen System landen — der
Markdown-Export ist dafür gemacht.

## Was es kostet

Nichts. MIT-Lizenz, zwei Dateien, keine Abhängigkeiten. Der Aufwand ist eine
`<link>`- und zwei `<script>`-Zeilen — oder ein Plugin-Upload.

---

**Weiter:** [Tutorial](TUTORIAL.md) ·
[Technische Dokumentation](TECHNISCHE_DOKUMENTATION.md) ·
[Live-Demo](https://daimpad.github.io/kommentator/)
