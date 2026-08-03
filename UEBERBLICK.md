# Der Kommentator — was er ist und wofür er taugt

Eine ausführliche Beschreibung für alle, die vor der Frage stehen, ob dieses
Werkzeug zu ihrer Arbeit passt. Wer direkt loslegen will:
[Tutorial](TUTORIAL.md). Wer die Schnittstellen sucht:
[Technische Dokumentation](TECHNISCHE_DOKUMENTATION.md).

---

## In einem Satz

Der Kommentator legt sich als **Klebezettel-Schicht über eine bestehende
Webseite**: Textstellen markieren, Elemente anklicken, Punkte anheften — jeweils
mit einem Kommentar daran, ohne dass an der Seite selbst irgendetwas geändert
wird.

## Das Problem, das er löst

Rückmeldungen zu einer Webseite sind notorisch mühsam. Sie kommen als
E-Mail-Fließtext („die Überschrift auf der zweiten Seite unten, das dritte
Wort…"), als Word-Datei mit Screenshots, als Telefonnotiz. Jede Rückmeldung
muss erst wieder auf der Seite lokalisiert werden — und bei fünf Beteiligten
liegen fünf Dateien in fünf Formaten vor.

Die üblichen Lösungen dafür sind Dienste wie Figma-Kommentare, Usersnap oder
Marker.io: leistungsfähig, aber gebunden an ein Konto, ein Abo, einen fremden
Server und eine Datenschutzprüfung.

Der Kommentator geht den anderen Weg: **zwei Dateien, die man neben die Seite
legt.** Kein Konto, kein Server, kein Abo, kein Build. Die Rückmeldung entsteht
dort, wo sie hingehört — direkt an der Stelle.

## Was er kann

### Drei Arten zu kommentieren

| Art | Wie | Wofür |
|---|---|---|
| **Text** | Textstelle markieren | „Dieser Satz ist missverständlich" |
| **Element** | Box, Bild oder Container anklicken | „Diese Kachel wirkt verloren" |
| **Punkt** | Nadel an eine beliebige Stelle heften | „Hier fehlt ein Abstand" |

Textmarkierungen laufen über Absatz- und Elementgrenzen hinweg. Element- und
Punkt-Kommentare erreichen auch das, was keinen Text hat: Bilder, Icons,
Leerräume.

### Kommentare finden ihre Stelle wieder

Jede Markierung speichert nicht nur eine Position, sondern auch den **exakten
Wortlaut plus etwas Kontext davor und danach**. Beim erneuten Einlesen wird
zuerst die Position probiert; passt der Text dort nicht mehr, sucht das Werkzeug
den Wortlaut — und wenn der mehrfach vorkommt, entscheidet der Kontext.

Element- und Punkt-Kommentare verankern zusätzlich **relativ**: gespeichert wird
der Pfad zum Element und die Position *darin* in Prozent. Ein Punkt bei „30 % von
links, 60 % von oben" sitzt nach einem Umbruch auf dem Handy immer noch an
derselben Stelle des Elements.

Das Datenmodell folgt dabei dem **W3C-Web-Annotation-Standard** — die Exporte
sind also kein Eigenformat, sondern lassen sich mit anderen Annotationswerkzeugen
weiterverarbeiten.

### Zwei Wege, Rückmeldungen zusammenzuführen

**Ohne alles:** Jede:r lädt die eigenen Kommentare als JSON herunter, du sammelst
die Dateien ein und liest sie gemeinsam wieder ein. Alle Notizen erscheinen
nebeneinander, doppelte werden erkannt. Umständlicher, aber vollständig
unabhängig — es verlässt buchstäblich nichts den Browser.

**Mit einer Sammelstelle:** Du hinterlegst eine Adresse — typischerweise ein
Google Sheet hinter einem kleinen Apps-Script. Dann meldet sich jeder Kommentar
automatisch dorthin, mit Seiten-URL, Zeitpunkt und markierter Stelle. Viele
Kommentierende auf vielen Seiten, **eine Tabelle**. Immer noch ohne Datenbank
und ohne eigenen Server.

Der zweite Weg ist **opt-in**. Ohne Adresse verhält sich das Werkzeug wie zuvor.

### Herausgeben

JSON (zum Wiedereinlesen), Markdown (zum Lesen), PDF über den Systemdruck
(Seite *mit* Notizen), E-Mail-Entwurf. Wahlweise zur Sammelstelle.

### Nebenbei

Hell-/Dunkelmodus, ziehbare Notizspalte, alles hinter einem Knopf unten rechts,
vollständig über CSS-Variablen umfärbbar, deutsche Texte an einer Stelle
gebündelt und überschreibbar, Tastaturbedienung mit sichtbarem Fokus, ARIA an
Markierungen und Dialogen, `prefers-reduced-motion`, funktioniert auf dem Handy.

## Wofür man ihn einsetzt

**Abnahmerunden.** Der klassische Fall: Entwurf steht, drei Leute sollen
draufschauen. Jede:r markiert direkt, was auffällt.

**Redaktionelle Durchsicht.** Lange Texte gegenlesen, ohne Änderungen im
Original vorzunehmen — Vorschläge stehen daneben statt drin.

**Barrierefreiheits- und Qualitätsprüfungen.** Befunde sitzen dort, wo sie
auftreten, statt in einer Tabelle mit Screenshot-Verweisen.

**Lehre und Schulung.** Ein Text wird gemeinsam annotiert; die Exporte lassen
sich einsammeln und auswerten.

**Nutzertests.** Testpersonen heften Anmerkungen an die Stellen, die sie irritieren.

**Interne Abstimmung in WordPress.** Mit dem Plugin ist die ganze Seite
kommentierbar — im Frontend *und* im Backend, also auch Admin-Menü und
Einstellungsseiten.

## Wofür er nicht gedacht ist

Ehrlichkeit spart Enttäuschung:

- **Kein Echtzeit-Werkzeug.** Niemand sieht die Kommentare der anderen live.
  Der Austausch ist bewusst zeitversetzt.
- **Kein Ticketsystem.** Kein Status, keine Zuweisung, keine Erledigt-Häkchen.
- **Kein Zugriffsschutz.** Das Namensfeld ordnet zu, es schützt nicht. Wer
  wirklich abschotten will, regelt das serverseitig (HTTP Basic Auth,
  WordPress-Login).
- **Kein Gedächtnis.** Ohne Sammelstelle ist der Zustand nach dem Neuladen weg
  — es gibt bewusst kein `localStorage`. Erst exportieren, dann schließen.
- **Nicht für stark wechselnde Inhalte.** Wenn sich der Text zwischen zwei
  Runden ändert, verlieren einzelne Markierungen ihren Halt.

## Wer sich damit auseinandersetzen sollte

**Agenturen und Freiberufler:innen**, die Entwürfe abnehmen lassen — der
häufigste Fall. Kundin bekommt einen Link, kommentiert direkt, schickt eine
Datei zurück oder alles läuft in die Tabelle.

**Redaktionen und Fachbereiche**, die Texte im Web gegenlesen, ohne ins CMS zu
greifen.

**Menschen mit Datenschutzauflagen.** Öffentliche Verwaltung, Bildung,
Gesundheitswesen, Betriebsräte: Es gibt keinen Auftragsverarbeiter, keine
Drittlandübermittlung, keine Cookies, kein Tracking. Ohne Sammelstelle verlässt
kein Byte den Browser; mit Sammelstelle geht es genau dorthin, wo du es
hinlegst. Gemeldet wird nie eine IP-Adresse, sondern eine anonyme
Sitzungskennung, die beim Schließen des Tabs verfällt — und der Hilfetext sagt
den Kommentierenden das ausdrücklich.

**WordPress-Betreiber:innen**, die Rückmeldungen zu Seiten sammeln wollen.
Plugin installieren, aktivieren, fertig; alles Weitere unter *Einstellungen →
Kommentator*.

**Entwickler:innen**, die so etwas in ein eigenes Produkt einbauen. Eine
Funktion, ein paar Optionen, Callbacks bei jeder Änderung, W3C-nahes
Datenmodell, MIT-Lizenz. Kein Framework, keine Abhängigkeit, kein Build —
`kommentare.js` ist bewusst ES5-tauglich und läuft ohne Transpiler.

**Wer sich Werkzeuge dieser Art anschauen will.** Der Quelltext ist eine
kompakte, lesbare Umsetzung von DOM-Ranges, Text-Wiederverankerung und
Overlay-Positionierung — mit Akzeptanztests, die die kniffligen Fälle
festhalten.

## Wen es eher nicht adressiert

Teams, die ein gemeinsames Live-Board mit Rechteverwaltung, Erwähnungen und
Erledigt-Status brauchen. Dafür gibt es die genannten Dienste, und die machen
das besser. Der Kommentator ist die Antwort auf „wir brauchen etwas
Unkompliziertes, und es darf nichts abfließen".

## Was es kostet

Nichts. MIT-Lizenz, zwei Dateien, keine Abhängigkeiten. Der Aufwand ist eine
`<link>`- und zwei `<script>`-Zeilen — oder ein Plugin-Upload.

---

**Weiter:** [Tutorial](TUTORIAL.md) · [Technische
Dokumentation](TECHNISCHE_DOKUMENTATION.md) ·
[Demo](https://daimpad.github.io/kommentator/)
