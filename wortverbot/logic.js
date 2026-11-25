// Wortverbot: Spielregeln ohne Netzwerk und ohne Oberfläche (window.WV).
// Zwei Teams. Reihum erklärt einer seinem Team Begriffe, ohne die verbotenen Wörter zu sagen; die Uhr läuft.
// Das andere Team sieht die Karte mit und tippt auf „Erwischt“, wenn ein verbotenes Wort fällt.
// Modus: nur Erklären, nur Pantomime (eigene Begriffe in PANTOMIME) oder gemischt (Erklären, Zeichnen und Pantomime im Wechsel).
// Die Karte steht nur beim Spielleiter im Zustand; mit sicht() bekommt das ratende Team eine Fassung ohne Karte.
// Phasen: lobby → bereit (Erklärer tippt auf „Los“) → spielen → bereit (mit Rückblick auf den letzten Zug) … → ende
(function () {
  // Karten: „Begriff:verboten,verboten,…“, getrennt mit „|“
  const KARTEN = (
    "Fahrrad:Rad,Pedal,Lenker,fahren,Kette|Kühlschrank:kalt,Küche,Milch,kühlen,Gefrierfach|Zahnbürste:Zähne,putzen,Zahnpasta,Bad,morgens|" +
    "Regenschirm:Regen,nass,aufspannen,Wetter,trocken|Brille:Augen,sehen,Gläser,Nase,Optiker|Geburtstag:Kuchen,Kerzen,Geschenk,Party,Jahr|" +
    "Weihnachten:Baum,Geschenke,Dezember,Christkind,Fest|Ostern:Hase,Eier,Frühling,suchen,Feiertag|Fußball:Tor,Ball,Mannschaft,Spiel,schießen|" +
    "Schwimmbad:Wasser,schwimmen,Becken,Sprungbrett,Badehose|Zahnarzt:Zähne,Bohrer,Praxis,Loch,Schmerzen|Feuerwehr:Feuer,löschen,Wasser,rot,Leiter|" +
    "Polizei:Verbrecher,Blaulicht,Polizist,Uniform,Gesetz|Krankenhaus:Arzt,krank,Bett,Operation,Patient|Flughafen:Flugzeug,fliegen,Koffer,Urlaub,Abflug|" +
    "Bahnhof:Zug,Gleis,Bahn,Fahrkarte,Bahnsteig|Supermarkt:einkaufen,Kasse,Einkaufswagen,Regal,Lebensmittel|Bäckerei:Brot,Brötchen,backen,Bäcker,Kuchen|" +
    "Bibliothek:Bücher,lesen,ausleihen,leise,Regal|Kino:Film,Leinwand,Popcorn,Kasse,Saal|Zirkus:Clown,Zelt,Manege,Artist,Löwe|" +
    "Zoo:Tiere,Gehege,Affen,Elefant,Besuch|Strand:Sand,Meer,Sonne,Urlaub,baden|Berg:hoch,Gipfel,wandern,klettern,Alpen|" +
    "Vulkan:Lava,Ausbruch,Berg,heiß,Krater|Gewitter:Blitz,Donner,Regen,Sturm,Wolken|Regenbogen:Farben,bunt,Regen,Sonne,Himmel|" +
    "Schneemann:Schnee,Winter,Karotte,Nase,bauen|Sonnenbrille:Sonne,Augen,dunkel,Sommer,Brille|Handy:telefonieren,Smartphone,anrufen,Akku,Nachricht|" +
    "Computer:Tastatur,Bildschirm,Maus,Internet,Laptop|Fernseher:Fernbedienung,Programm,schauen,Sendung,Bildschirm|Kopfhörer:Ohren,Musik,hören,Kabel,laut|" +
    "Wecker:Uhr,klingeln,morgens,aufstehen,schlafen|Kaffee:trinken,Tasse,Bohnen,wach,Koffein|Pizza:Italien,Käse,Tomate,Ofen,Teig|" +
    "Spaghetti:Nudeln,Italien,Soße,Bolognese,Gabel|Schokolade:süß,braun,Kakao,Tafel,Milka|Eis:kalt,Waffel,Sommer,Kugel,schlecken|" +
    "Popcorn:Mais,Kino,süß,salzig,knallen|Banane:gelb,Obst,Affe,krumm,schälen|Apfel:Obst,Baum,rot,grün,Saft|" +
    "Zitrone:sauer,gelb,Frucht,Saft,Limonade|Kartoffel:Pommes,Knolle,Acker,Brei,schälen|Frühstück:morgens,essen,Brötchen,Müsli,Kaffee|" +
    "Picknick:Decke,Korb,draußen,Wiese,essen|Grillen:Grill,Würstchen,Fleisch,Kohle,Sommer|Kuchen:backen,süß,Geburtstag,Torte,Stück|" +
    "Hund:bellen,Haustier,Gassi,Leine,Katze|Katze:miauen,Haustier,Maus,schnurren,Hund|Elefant:Rüssel,groß,grau,Afrika,Stoßzähne|" +
    "Giraffe:Hals,lang,Afrika,Flecken,groß|Pinguin:Eis,Vogel,schwarz,weiß,Antarktis|Schlange:giftig,Reptil,lang,zischen,kriechen|" +
    "Spinne:acht,Beine,Netz,Insekt,Angst|Biene:Honig,summen,stechen,gelb,Blume|Schmetterling:Flügel,bunt,Raupe,fliegen,Insekt|" +
    "Hai:Fisch,Meer,Zähne,gefährlich,Flosse|Delfin:Meer,klug,springen,Wal,Flipper|Kuh:Milch,muhen,Bauernhof,Weide,Kalb|" +
    "Pferd:reiten,Sattel,wiehern,Hufe,Pony|Hase:Ohren,Karotte,hoppeln,Ostern,Kaninchen|Eule:Vogel,Nacht,weise,Augen,heulen|" +
    "Dinosaurier:ausgestorben,groß,Urzeit,T-Rex,Knochen|Drache:Feuer,Flügel,Märchen,speien,Ritter|Einhorn:Horn,Pferd,Fabelwesen,Regenbogen,weiß|" +
    "Gespenst:Geist,Laken,spuken,Buh,Schloss|Hexe:Besen,zaubern,Hut,Märchen,Katze|Pirat:Schiff,Schatz,Augenklappe,Meer,Papagei|" +
    "Ritter:Rüstung,Schwert,Burg,Pferd,Mittelalter|Prinzessin:König,Krone,Schloss,Märchen,Tochter|Zauberer:Zauberstab,Magie,Hut,Trick,Kaninchen|" +
    "Astronaut:Weltall,Rakete,Mond,Raumanzug,fliegen|Rakete:Weltall,fliegen,starten,Astronaut,Mond|Mond:Nacht,Himmel,Erde,rund,Vollmond|" +
    "Sonne:hell,warm,Himmel,Stern,scheinen|Stern:Himmel,Nacht,leuchten,funkeln,Sonne|Weltall:Planeten,Sterne,Rakete,schwarz,Universum|" +
    "Leuchtturm:Licht,Meer,Schiffe,Turm,Küste|Brücke:Fluss,überqueren,Wasser,bauen,Ufer|Schloss:König,Burg,Prinzessin,Tür,Schlüssel|" +
    "Kirche:Gott,beten,Pfarrer,Glocke,Gottesdienst|Pyramide:Ägypten,Pharao,Dreieck,Wüste,Grab|Wüste:Sand,heiß,Kamel,trocken,Oase|" +
    "Dschungel:Urwald,Affen,Bäume,feucht,Tarzan|Insel:Meer,Wasser,Strand,Palme,umgeben|Wasserfall:Wasser,fallen,Fluss,Niagara,hinunter|" +
    "Tannenbaum:Weihnachten,Nadeln,grün,schmücken,Wald|Garten:Blumen,Rasen,Gemüse,Haus,gießen|Blume:Blüte,duften,Rose,Garten,pflücken|" +
    "Kaktus:Stacheln,Wüste,Pflanze,stechen,grün|Pilz:Wald,sammeln,giftig,Hut,Fliegenpilz|Herbst:Blätter,bunt,Jahreszeit,Wind,Oktober|" +
    "Winter:kalt,Schnee,Jahreszeit,Weihnachten,frieren|Sommer:heiß,Sonne,Jahreszeit,Ferien,baden|Urlaub:Reise,Ferien,Erholung,Koffer,Hotel|" +
    "Koffer:packen,Reise,Urlaub,Kleidung,Rollen|Zelt:campen,schlafen,Hering,draußen,aufbauen|Hotel:Zimmer,übernachten,Urlaub,Rezeption,Bett|" +
    "Auto:fahren,Räder,Straße,Motor,Lenkrad|Flugzeug:fliegen,Flughafen,Pilot,Flügel,Himmel|Schiff:Meer,Kapitän,Wasser,fahren,Hafen|" +
    "U-Bahn:Untergrund,Zug,Stadt,Station,fahren|Taxi:Fahrer,bezahlen,gelb,Auto,fahren|Hubschrauber:fliegen,Rotor,Propeller,landen,Helikopter|" +
    "Ampel:rot,grün,gelb,Straße,Kreuzung|Stau:Autobahn,Autos,warten,stehen,Verkehr|Tankstelle:Benzin,tanken,Auto,Diesel,Zapfsäule|" +
    "Führerschein:Auto,Prüfung,fahren,Fahrschule,Ausweis|Parkplatz:parken,Auto,abstellen,Lücke,Parkhaus|Baustelle:Bagger,bauen,Kran,Helm,Arbeiter|" +
    "Arzt:krank,Praxis,Doktor,Patient,heilen|Lehrer:Schule,unterrichten,Klasse,Schüler,Tafel|Koch:kochen,Küche,Restaurant,Mütze,Essen|" +
    "Friseur:Haare,schneiden,Schere,Frisur,Salon|Bauer:Bauernhof,Traktor,Feld,Kühe,Ernte|Briefträger:Post,Brief,Paket,zustellen,Briefkasten|" +
    "Schule:lernen,Lehrer,Klasse,Unterricht,Schüler|Hausaufgaben:Schule,Lehrer,machen,lernen,nachmittags|Zeugnis:Noten,Schule,Schuljahr,Halbjahr,Eltern|" +
    "Tafel:Kreide,Schule,schreiben,Lehrer,wischen|Rucksack:tragen,Rücken,Tasche,wandern,Schule|Bleistift:schreiben,Mine,spitzen,Radiergummi,Holz|" +
    "Schere:schneiden,Papier,scharf,basteln,Klinge|Buch:lesen,Seiten,Bibliothek,Autor,Roman|Zeitung:lesen,Nachrichten,Papier,täglich,Artikel|" +
    "Brief:schreiben,Post,Umschlag,Briefmarke,schicken|Geschenk:schenken,Geburtstag,verpacken,Überraschung,Schleife|Party:feiern,Musik,tanzen,Gäste,Fest|" +
    "Hochzeit:heiraten,Braut,Ring,Kirche,Kleid|Kuss:Lippen,küssen,Liebe,Mund,Schmatz|Liebe:Herz,lieben,verliebt,Partner,Gefühl|" +
    "Baby:klein,Windel,Kinderwagen,geboren,weinen|Oma:Großmutter,Opa,alt,Enkel,Familie|Familie:Eltern,Kinder,Geschwister,Verwandte,Mutter|" +
    "Freund:Freundschaft,Kumpel,mögen,Spaß,Freundin|Nachbar:nebenan,wohnen,Haus,neben,Tür|Schlafanzug:schlafen,Nacht,Bett,anziehen,Pyjama|" +
    "Bett:schlafen,Kissen,Decke,liegen,Matratze|Dusche:Wasser,waschen,Bad,Seife,nass|Badewanne:baden,Wasser,Bad,Schaum,liegen|" +
    "Toilette:Klo,Bad,Spülung,WC,Papier|Spiegel:sehen,Bild,Glas,Bad,spiegeln|Treppe:Stufen,hoch,runter,Geländer,Stockwerk|" +
    "Fenster:Glas,Scheibe,öffnen,Haus,putzen|Tür:öffnen,schließen,Schlüssel,Klinke,Haus|Schlüssel:Schloss,Tür,aufschließen,Bund,verlieren|" +
    "Kerze:Wachs,Docht,Flamme,anzünden,Licht|Lampe:Licht,hell,Glühbirne,Strom,anschalten|Uhr:Zeit,Zeiger,Stunde,Minute,tragen|" +
    "Kalender:Datum,Monat,Tag,Jahr,Termin|Geld:bezahlen,Euro,Münzen,Scheine,Bank|Bank:Geld,Konto,sparen,sitzen,Park|" +
    "Lotto:Zahlen,Gewinn,Jackpot,ziehen,Millionen|Würfel:sechs,Augen,werfen,Spiel,Zahl|Puzzle:Teile,legen,Bild,zusammen,Spiel|" +
    "Karten:Spiel,mischen,Stapel,Ass,Herz|Schach:Brett,König,Dame,Figuren,matt|Verstecken:suchen,finden,zählen,Spiel,Kinder|" +
    "Gitarre:Saiten,Instrument,Musik,spielen,zupfen|Klavier:Tasten,Instrument,Flügel,spielen,Musik|Schlagzeug:Trommel,Musik,Stöcke,laut,Becken|" +
    "Konzert:Musik,Band,Bühne,Publikum,Tickets|Tanzen:Musik,Disco,bewegen,Paar,Party|Singen:Lied,Stimme,Chor,Musik,Karaoke|" +
    "Zauberwürfel:drehen,Farben,Würfel,Rätsel,lösen|Luftballon:aufblasen,Luft,platzen,Party,Gummi|Drachen steigen:Wind,Schnur,Herbst,fliegen,Himmel|" +
    "Sandburg:Sand,Strand,bauen,Eimer,Schaufel|Schaukel:schaukeln,Spielplatz,hin,her,Kette|Rutsche:rutschen,Spielplatz,runter,Kinder,Wasser|" +
    "Trampolin:springen,hüpfen,Netz,hoch,Garten|Achterbahn:Freizeitpark,Loopings,schnell,Kirmes,fahren|Kirmes:Rummel,Karussell,Zuckerwatte,Jahrmarkt,Fahrgeschäft|" +
    "Fasching:Karneval,Kostüm,verkleiden,Helau,Alaaf|Silvester:Neujahr,Feuerwerk,Mitternacht,Dezember,Raketen|Feuerwerk:Raketen,Silvester,bunt,Himmel,knallen|" +
    "Olympia:Spiele,Sport,Medaille,Ringe,Gold|Marathon:laufen,Kilometer,rennen,lang,Ziel|Fahrradhelm:Kopf,schützen,Fahrrad,Unfall,tragen|" +
    "Tennis:Schläger,Ball,Netz,Platz,Aufschlag|Schwimmen:Wasser,Becken,Kraulen,Brustschwimmen,Bad|Skifahren:Schnee,Piste,Berg,Winter,Lift|" +
    "Joggen:laufen,rennen,Sport,Turnschuhe,Park|Yoga:Übung,dehnen,Matte,entspannen,Meditation|Fitnessstudio:Sport,trainieren,Hanteln,Muskeln,Geräte|" +
    "Schnupfen:Nase,krank,Taschentuch,niesen,Erkältung|Schluckauf:hicksen,Hicks,Zwerchfell,Wasser,erschrecken|Gähnen:müde,Mund,schlafen,langweilig,offen|" +
    "Niesen:Nase,Hatschi,Schnupfen,Gesundheit,kitzeln|Kitzeln:lachen,Finger,Fuß,kitzlig,Bauch|Schnarchen:schlafen,laut,Nacht,Geräusch,Bett|" +
    "Lachen:lustig,Witz,Freude,lächeln,Spaß|Weinen:Tränen,traurig,Augen,heulen,Taschentuch|Angst:fürchten,Furcht,gruselig,Herzklopfen,Panik|" +
    "Langeweile:langweilig,nichts,tun,Zeit,öde|Hunger:essen,Magen,knurren,Appetit,satt|Durst:trinken,Wasser,Hals,trocken,Glas|" +
    "Müdigkeit:müde,schlafen,gähnen,Bett,erschöpft|Muskelkater:Sport,Muskeln,Schmerzen,Training,steif|Sonnenbrand:Sonne,rot,Haut,Creme,Strand|" +
    "Gänsehaut:frieren,kalt,Haare,Haut,Schauer|Kopfschmerzen:Kopf,weh,Tablette,Migräne,Schmerzen|Ohrwurm:Lied,Kopf,Melodie,Ohr,summen|" +
    "Selfie:Foto,Handy,selbst,Kamera,Gesicht|Emoji:Smiley,Gesicht,Nachricht,Handy,Bild|WLAN:Internet,Passwort,kabellos,Router,Netz|" +
    "Passwort:geheim,Kennwort,anmelden,Zahlen,vergessen|Videospiel:Konsole,spielen,Controller,Level,zocken|Staubsauger:saugen,Staub,putzen,Boden,laut|" +
    "Waschmaschine:Wäsche,waschen,Kleidung,schleudern,Trommel|Mülleimer:Müll,Abfall,wegwerfen,Tonne,Deckel|Kochtopf:kochen,Herd,Deckel,Suppe,Küche|" +
    "Mikrowelle:aufwärmen,Essen,Küche,schnell,Strahlen|Toaster:Brot,Toast,warm,knusprig,Frühstück|Gabel:Messer,essen,Besteck,Zinken,Löffel|" +
    "Sofa:Couch,sitzen,Wohnzimmer,liegen,bequem|Kissen:Kopf,weich,Bett,schlafen,Feder|Socke:Fuß,anziehen,Paar,Schuh,stricken|" +
    "Schal:Hals,Winter,warm,Wolle,Mütze|Handschuh:Hand,Finger,Winter,warm,anziehen|Krawatte:Hals,Hemd,Anzug,binden,Knoten|" +
    "Hut:Kopf,tragen,Mütze,Krempe,Sonne|Regenmantel:Regen,Jacke,nass,wasserdicht,Kapuze|Gummistiefel:Regen,Füße,Pfützen,Schuhe,Gummi|" +
    "Pfütze:Regen,Wasser,springen,nass,Boden|Schneeball:Schnee,werfen,Schlacht,rund,Winter|Schlitten:Schnee,rodeln,Berg,Winter,fahren|" +
    "Eiszapfen:Eis,Dach,hängen,kalt,spitz|Iglu:Schnee,Eis,Haus,Eskimo,Inuit|Lagerfeuer:Feuer,Holz,Stockbrot,draußen,warm|" +
    "Taschenlampe:Licht,dunkel,Batterie,leuchten,Nacht|Schatz:Gold,Pirat,Truhe,Karte,suchen|Landkarte:Karte,Weg,Orte,Navi,Straßen|" +
    "Kompass:Norden,Richtung,Nadel,Himmelsrichtung,Magnet|Fernglas:sehen,weit,Augen,beobachten,Ferne|Kamera:Foto,fotografieren,Bild,Objektiv,knipsen|" +
    "Geist aus der Flasche:Wunsch,Lampe,Aladin,drei,reiben|Weihnachtsmann:Bart,rot,Geschenke,Rentier,Schlitten|Osterhase:Eier,Ostern,verstecken,Hase,Schokolade|" +
    "Zahnfee:Zahn,Kissen,Münze,Nacht,Kinder|Superheld:Kräfte,retten,Umhang,fliegen,Held|Roboter:Maschine,Metall,programmiert,Technik,künstlich|" +
    "Zeitreise:Vergangenheit,Zukunft,Maschine,reisen,Zeit|Außerirdischer:Alien,Weltall,Ufo,grün,Mars|Vampir:Blut,beißen,Dracula,Zähne,Nacht|" +
    "Mumie:Ägypten,Pyramide,Binden,eingewickelt,tot|Zwerg:klein,Schneewittchen,sieben,Mütze,Bart|Riese:groß,Märchen,stark,Zwerg,hoch|" +
    "Detektiv:Fall,lösen,Lupe,Spuren,Sherlock|Spion:geheim,Agent,James Bond,beobachten,Mission|Dieb:stehlen,klauen,Polizei,Beute,Einbruch|" +
    "Gefängnis:Knast,Gitter,Zelle,Verbrecher,Strafe|Richter:Gericht,Urteil,Hammer,Gesetz,Angeklagter|Bürgermeister:Stadt,Rathaus,gewählt,Gemeinde,Chef|" +
    "Wahl:wählen,Stimme,Partei,Kreuz,Urne|König:Krone,Thron,Königin,herrschen,Schloss|Krone:König,Kopf,Gold,tragen,Edelsteine|" +
    "Museum:Ausstellung,Bilder,Kunst,besichtigen,alt|Theater:Bühne,Schauspieler,Vorhang,Stück,Publikum|Fotoalbum:Fotos,Bilder,Erinnerung,blättern,kleben|" +
    "Tagebuch:schreiben,geheim,Tag,Erlebnis,Schloss|Wunschzettel:Wünsche,Weihnachten,Geschenke,schreiben,Liste|Einkaufsliste:einkaufen,Zettel,Supermarkt,aufschreiben,vergessen|" +
    "Umzug:umziehen,Kisten,Wohnung,neu,tragen|Hausarbeit:putzen,Haushalt,aufräumen,waschen,spülen|Aufräumen:Ordnung,Zimmer,Chaos,wegräumen,sauber|" +
    "Kreuzworträtsel:Rätsel,Wörter,Kästchen,senkrecht,waagerecht|Witz:lustig,lachen,Pointe,erzählen,Humor|Geheimnis:geheim,verraten,Rätsel,niemand,wissen|" +
    "Lüge:lügen,Wahrheit,Pinocchio,falsch,schwindeln|Überraschung:überraschen,unerwartet,Geschenk,Party,staunen|Ausrede:Entschuldigung,Lüge,Grund,erfinden,Schule|" +
    "Wette:wetten,gewinnen,verlieren,Einsatz,Tipp|Rekord:Weltrekord,Guinness,brechen,schnellste,beste|Glück:Klee,Pech,glücklich,Zufall,Schwein|" +
    "Pech:Unglück,Glück,Schwarze Katze,Freitag,Missgeschick|Zufall:Glück,Würfel,zufällig,überraschend,Schicksal|Traum:schlafen,Nacht,träumen,Albtraum,Wunsch|" +
    "Albtraum:schlecht,Traum,Angst,Nacht,aufwachen|Erinnerung:erinnern,vergessen,Gedächtnis,früher,denken|Hobby:Freizeit,Spaß,machen,Interesse,Sammeln|" +
    "Sammeln:Sammlung,Briefmarken,Hobby,suchen,Pilze|Stricken:Wolle,Nadeln,Pullover,Masche,Oma|Angeln:Fisch,Rute,See,Haken,Köder|" +
    "Bowling:Kugel,Pins,Kegel,Bahn,Strike|Minigolf:Golf,Schläger,Ball,Loch,Bahn|Kegeln:Kugel,Kegel,Bahn,umwerfen,Verein|" +
    "Sauna:heiß,schwitzen,Aufguss,Holz,nackt|Massage:Rücken,entspannen,kneten,Hände,Muskeln|Friedhof:Gräber,tot,Kirche,Blumen,Grabstein|" +
    "Bauernhof:Bauer,Tiere,Kühe,Stall,Traktor|Traktor:Bauer,Feld,fahren,Anhänger,Landwirt|Windmühle:Wind,Mehl,Flügel,Holland,drehen|" +
    "Wolkenkratzer:Hochhaus,hoch,Stadt,Stockwerke,New York|Aufzug:Fahrstuhl,Stockwerk,hoch,runter,Knopf|Rolltreppe:Treppe,Kaufhaus,fahren,Stufen,hoch|" +
    "Kaufhaus:einkaufen,Abteilung,Stockwerk,Rolltreppe,Laden|Flohmarkt:alt,verkaufen,Stand,gebraucht,handeln|Wochenmarkt:Gemüse,Stand,Obst,einkaufen,Samstag|" +
    "Spielplatz:Kinder,Rutsche,Schaukel,Sandkasten,spielen|Park:Bäume,Wiese,spazieren,Bank,grün|See:Wasser,schwimmen,Ufer,Boot,Meer|" +
    "Wald:Bäume,grün,Förster,Spaziergang,Pilze|Höhle:dunkel,Fels,Berg,Fledermaus,Eingang|Gletscher:Eis,Berg,schmelzen,kalt,Alpen|" +
    "Erdbeben:Erde,wackeln,beben,Richterskala,Zerstörung|Sturm:Wind,stark,Orkan,wehen,Wetter|Nebel:grau,sehen,Wetter,dicht,Herbst|" +
    "Wetterbericht:Wetter,Regen,Sonne,Vorhersage,Fernsehen|Zeitumstellung:Uhr,Stunde,Sommerzeit,Winterzeit,vorstellen|Mittagspause:Mittag,essen,Arbeit,Pause,Kantine|" +
    "Feierabend:Arbeit,Ende,nach,Hause,Schluss|Wochenende:Samstag,Sonntag,frei,Woche,ausschlafen|Montag:Woche,Tag,Anfang,Arbeit,Dienstag" +
    // Erweiterung November 2026
    "|Tiger:Streifen,Raubkatze,gestreift,Löwe,Dschungel|Löwe:König,Mähne,brüllen,Raubkatze,Afrika|Krokodil:Zähne,Fluss,Reptil,grün,Maul" +
    "|Koala:Australien,Baum,Bär,Eukalyptus,schlafen|Eichhörnchen:Nüsse,Baum,Schwanz,rot,klettern|Fuchs:rot,schlau,Wald,Schwanz,Hühner" +
    "|Bär:Honig,braun,groß,Winterschlaf,Teddy|Ratte:Nagetier,Kanal,Schwanz,eklig,Maus|Frosch:quaken,grün,Teich,springen,Prinz" +
    "|Papagei:Vogel,sprechen,bunt,Federn,nachplappern|Hahn:krähen,morgens,Huhn,Bauernhof,Kamm|Schwein:rosa,Schlamm,grunzen,Bauernhof,Ferkel" +
    "|Ziege:meckern,Milch,Käse,Hörner,Berg|Kamel:Wüste,Höcker,Wasser,reiten,Dromedar|Nilpferd:Wasser,dick,Afrika,Maul,Fluss" +
    "|Nashorn:Horn,grau,Afrika,dick,Haut|Krake:Arme,acht,Tinte,Meer,Tentakel|Seestern:Meer,Arme,fünf,Strand,Stern" +
    "|Ameise:klein,Haufen,fleißig,Insekt,krabbeln|Marienkäfer:Punkte,rot,Glück,Käfer,schwarz|Regenwurm:Erde,Regen,lang,kriechen,Angel" +
    "|Storch:Baby,Vogel,Nest,Beine,klappern|Adler:Vogel,fliegen,Krallen,Wappen,Greifvogel|Goldfisch:Aquarium,Glas,orange,schwimmen,Haustier" +
    "|Wellensittich:Vogel,Käfig,bunt,Haustier,zwitschern|Pommes:Kartoffel,Ketchup,Mayo,frittiert,Imbiss|Döner:Fleisch,Brot,Imbiss,Soße,türkisch" +
    "|Sushi:Fisch,Reis,roh,Japan,Stäbchen|Salat:grün,Gurke,Dressing,gesund,Blätter|Müsli:Frühstück,Milch,Haferflocken,Schüssel,Körner" +
    "|Marmelade:Erdbeere,süß,Brot,Glas,Frucht|Käse:Milch,gelb,Löcher,Maus,Scheibe|Ei:Huhn,Schale,gekocht,Dotter,Frühstück" +
    "|Wassermelone:grün,rot,Kerne,Sommer,Frucht|Kirsche:rot,Kern,Baum,Frucht,Stiel|Karotte:orange,Gemüse,Hase,Möhre,Augen" +
    "|Gurke:grün,Salat,Gemüse,sauer,lang|Zwiebel:weinen,schälen,Gemüse,scharf,Schichten|Brezel:Salz,Bäcker,Bayern,Teig,verschlungen" +
    "|Pfannkuchen:Pfanne,Teig,flach,Sirup,Crêpe|Lebkuchen:Weihnachten,Herz,Gewürz,Markt,süß|Lutscher:Stiel,süß,lecken,Bonbon,Kind" +
    "|Tee:trinken,heiß,Kanne,Beutel,Kräuter|Saft:Orange,trinken,Obst,Glas,pressen|Bier:Alkohol,trinken,Kneipe,Schaum,Oktoberfest" +
    "|Sekt:prickeln,Silvester,Flasche,anstoßen,Champagner|Wasserkocher:Wasser,heiß,Tee,Küche,kochen|Backofen:backen,heiß,Kuchen,Küche,Pizza" +
    "|Föhn:Haare,trocknen,Luft,warm,Bad|Zahnpasta:Zähne,Tube,putzen,Bürste,Minze|Seife:waschen,Hände,Schaum,sauber,Duft" +
    "|Kleiderschrank:Kleidung,Tür,Schlafzimmer,Möbel,hängen|Teppich:Boden,weich,Wohnzimmer,fliegen,saugen|Vorhang:Fenster,zuziehen,Stoff,Gardine,Bühne" +
    "|Stuhl:sitzen,Beine,Tisch,Lehne,Möbel|Hängematte:schaukeln,liegen,Bäume,Urlaub,Netz|Briefkasten:Post,Brief,gelb,Briefträger,einwerfen" +
    "|Klingel:Tür,läuten,Haustür,Besuch,drücken|Schraubenzieher:Schraube,drehen,Werkzeug,Kreuz,schrauben|Bohrmaschine:Loch,Wand,bohren,Werkzeug,Dübel" +
    "|Leiter:Sprossen,hoch,klettern,steigen,Stufen|Batterie:Strom,Akku,leer,Energie,Fernbedienung|Glühbirne:Licht,Lampe,hell,Strom,Edison" +
    "|Besen:fegen,kehren,Hexe,Boden,Schaufel|Gießkanne:Blumen,Wasser,gießen,Garten,Pflanzen|Schubkarre:Garten,schieben,Rad,Erde,transportieren" +
    "|Vogelscheuche:Feld,Krähen,Stroh,erschrecken,Bauer|Bauarbeiter:Helm,Baustelle,bauen,Bagger,Arbeit|Kran:Baustelle,hoch,heben,Haken,Turm" +
    "|Krankenwagen:Blaulicht,Sirene,Notarzt,Unfall,Krankenhaus|Stewardess:Flugzeug,Getränke,Uniform,Passagiere,fliegen|Kapitän:Schiff,Mütze,Steuer,Meer,Kommando" +
    "|Bäcker:Brot,backen,Brötchen,früh,Mehl|Gärtner:Pflanzen,Garten,Blumen,gießen,grün|Tierarzt:Tiere,krank,Hund,Praxis,Spritze" +
    "|Apotheke:Medikamente,Tabletten,Rezept,Apotheker,Arzt|Kellner:Restaurant,bedienen,Essen,Trinkgeld,Bestellung|Sänger:singen,Lied,Stimme,Bühne,Mikrofon" +
    "|Fotograf:Foto,Kamera,Bild,knipsen,Lächeln|Architekt:Haus,planen,bauen,Zeichnung,Gebäude|Journalist:Zeitung,schreiben,Nachrichten,Reporter,Artikel" +
    "|Erzieherin:Kindergarten,Kinder,spielen,betreuen,Kita|Clown:Zirkus,rote Nase,lustig,Schminke,lachen|Café:Kaffee,Kuchen,sitzen,trinken,Tasse" +
    "|Disco:tanzen,Musik,Nacht,DJ,Party|Kindergarten:Kinder,spielen,Erzieherin,klein,Kita|Rathaus:Bürgermeister,Stadt,Amt,Gebäude,Verwaltung" +
    "|Campingplatz:Zelt,Wohnwagen,Urlaub,Natur,campen|Wohnwagen:Camping,Auto,Urlaub,ziehen,Wohnmobil|Aquarium:Fische,Wasser,Glas,schwimmen,Becken" +
    "|Autobahn:schnell,Auto,Spur,Stau,fahren|Zebrastreifen:Straße,überqueren,Fußgänger,Streifen,weiß|Straßenbahn:Schienen,Stadt,Tram,fahren,Haltestelle" +
    "|Zug:Bahn,Gleis,Lokomotive,Bahnhof,Waggon|Roller:fahren,zwei,Räder,Tretroller,Vespa|Segelboot:Wind,Segel,Wasser,Mast,See" +
    "|U-Boot:Wasser,tauchen,unter,Meer,Schiff|Fallschirm:springen,Flugzeug,fallen,Luft,landen|Fahrkarte:Zug,Ticket,Bus,kaufen,Kontrolleur" +
    "|Reisepass:Grenze,Ausweis,Urlaub,Foto,Land|Blitzer:Foto,zu schnell,Auto,Strafe,Polizei|Basketball:Korb,Ball,werfen,Halle,NBA" +
    "|Volleyball:Netz,Ball,Strand,Team,Baggern|Eishockey:Eis,Puck,Schläger,Tor,Schlittschuh|Boxen:Handschuhe,Ring,schlagen,Kampf,K.o." +
    "|Surfen:Welle,Brett,Meer,Strand,Wellenreiten|Tauchen:Wasser,Meer,Flasche,Fische,unter|Wandern:Berg,laufen,Wanderschuhe,Natur,Rucksack" +
    "|Snowboard:Schnee,Brett,Piste,Berg,Winter|Tischtennis:Ping-Pong,Platte,Schläger,Ball,Netz|Billard:Kugeln,Queue,Tisch,Loch,Kneipe" +
    "|Turnen:Halle,Barren,Matte,Sport,Rolle|Pokal:gewinnen,Sieger,Gold,Preis,Turnier|Medaille:Gold,Silber,Bronze,Sieger,Olympia" +
    "|Elfmeter:Fußball,Tor,schießen,Strafstoß,Torwart|Trainer:Mannschaft,Sport,Training,Coach,Taktik|Zuschauer:schauen,Publikum,Stadion,Fans,Tribüne" +
    "|Geige:Bogen,Saiten,Orchester,Violine,spielen|Flöte:blasen,Löcher,Instrument,Blockflöte,Ton|Orchester:Musik,Dirigent,Instrumente,Konzert,Klassik" +
    "|Dirigent:Orchester,Stab,Takt,Musik,leiten|Karaoke:singen,Lied,Mikrofon,Text,Bildschirm|Schallplatte:Musik,drehen,Plattenspieler,Vinyl,schwarz" +
    "|Kopfkissen:schlafen,Bett,weich,Kopf,Federn|Teddybär:Kuscheltier,Kind,weich,Bär,Spielzeug|Lego:Steine,bauen,Spielzeug,bunt,Dänemark" +
    "|Kreisel:drehen,Spielzeug,Kind,schnell,umfallen|Seifenblase:pusten,platzen,Seife,rund,schillern|Memory:Karten,Paare,merken,umdrehen,Gedächtnis" +
    "|Domino:Steine,umfallen,Reihe,Punkte,Spiel|Schnitzeljagd:Hinweise,suchen,Pfeile,Schatz,Spur|Seilspringen:Seil,springen,hüpfen,schwingen,Kinder" +
    "|Sandkasten:Sand,Kinder,Schaufel,Eimer,spielen|Schnuller:Baby,saugen,Mund,beruhigen,Nuckel|Kinderwagen:Baby,schieben,Räder,spazieren,Buggy" +
    "|Wiege:Baby,schaukeln,schlafen,Bett,Wiegenlied|Geschwister:Bruder,Schwester,Familie,Eltern,streiten|Opa:Großvater,alt,Oma,Enkel,Familie" +
    "|Haustier:Hund,Katze,Tier,zu Hause,füttern|Konfirmation:Kirche,Jugend,evangelisch,Fest,Geschenke|Flitterwochen:Hochzeit,Urlaub,Brautpaar,Reise,verliebt" +
    "|Verlobung:Ring,heiraten,Antrag,knien,Hochzeit|Muttertag:Mama,Mai,Blumen,Feiertag,danke|Halloween:Kürbis,Süßes,Saures,verkleiden,Oktober" +
    "|Kürbis:orange,Halloween,Herbst,Suppe,schnitzen|Nikolaus:Stiefel,Dezember,Bart,Geschenke,Rute|Glühwein:Weihnachtsmarkt,warm,Wein,Winter,Tasse" +
    "|Lawine:Schnee,Berg,rutschen,gefährlich,Ski|Frühling:Blumen,Jahreszeit,März,warm,blühen|Hagel:Eis,Körner,Gewitter,fallen,Regen" +
    "|Sonnenuntergang:Sonne,Abend,rot,Horizont,romantisch|Sternschnuppe:Himmel,wünschen,Nacht,fallen,Stern|Planet:Erde,Mars,Sonne,Weltall,kreisen" +
    "|Teleskop:Sterne,Fernrohr,schauen,Himmel,Linse|Teich:Wasser,Frösche,Garten,klein,Enten|Meer:Wasser,Salz,Wellen,Strand,Ozean" +
    "|Muschel:Meer,Strand,Schale,Perle,sammeln|Kokosnuss:Palme,braun,Milch,hart,Frucht|Baum:Blätter,Stamm,Wald,Äste,Holz" +
    "|Wiese:Gras,grün,Blumen,Kühe,Feld|Moor:Sumpf,nass,versinken,Torf,Nebel|Sonnenblume:gelb,groß,Kerne,Sonne,Blume" +
    "|Löwenzahn:Pusteblume,gelb,Wiese,pusten,Unkraut|Brennnessel:brennen,Pflanze,jucken,Blätter,Tee|Moos:grün,Wald,weich,Stein,feucht" +
    "|Eichel:Eiche,Baum,Herbst,Eichhörnchen,Nuss|Nuss:Schale,knacken,Eichhörnchen,hart,Haselnuss|Pflaster:Wunde,kleben,Blut,Verletzung,Hansaplast" +
    "|Fieber:krank,heiß,Thermometer,Temperatur,Grippe|Gips:Bein,gebrochen,Arm,weiß,Arzt|Krücken:gehen,Bein,gebrochen,stützen,humpeln" +
    "|Bart:Haare,Mann,Gesicht,rasieren,Kinn|Sommersprossen:Punkte,Gesicht,Sonne,braun,Haut|Ohrring:Ohr,Schmuck,Loch,tragen,Gold" +
    "|Halskette:Hals,Schmuck,Kette,Perlen,tragen|Schmuck:Gold,Ring,Kette,tragen,glänzen|Lippenstift:Lippen,rot,schminken,Make-up,Frau" +
    "|Strandkorb:Strand,sitzen,Nordsee,Korb,Wind|Sonnencreme:Sonne,eincremen,Haut,Sonnenbrand,Schutz|Badeanzug:schwimmen,Bikini,Strand,Frau,Wasser" +
    "|Taucherbrille:Augen,Wasser,tauchen,Glas,sehen|Postkarte:Urlaub,schreiben,Bild,Briefmarke,Grüße|Jetlag:müde,Flug,Zeit,Zeitzone,Reise" +
    "|Kreuzfahrt:Schiff,Urlaub,Meer,Reise,Kabine|Wohnmobil:Camping,fahren,Urlaub,Bett,Auto|Burg:Ritter,Mauer,Turm,Mittelalter,Schloss" +
    "|Kerker:Gefängnis,Burg,dunkel,Ketten,eingesperrt|Zauberstab:zaubern,Magie,Harry Potter,Stab,Hexe|Kristallkugel:Zukunft,Wahrsagerin,Glas,schauen,rund" +
    "|Fee:Flügel,zaubern,klein,Märchen,Wunsch|Elfe:Ohren,spitz,Wald,Märchen,klein|Werwolf:Vollmond,Wolf,verwandeln,Nacht,heulen" +
    "|Skelett:Knochen,Totenkopf,Halloween,Gerippe,weiß|Meerjungfrau:Fischschwanz,Meer,Arielle,Sirene,schwimmen|Cowboy:Pferd,Hut,Wilder Westen,Lasso,Revolver" +
    "|Mönch:Kloster,beten,Kutte,Kirche,Glatze|Kaiser:König,Reich,Krone,herrschen,Rom|Königin:König,Krone,England,Schloss,regieren" +
    "|Gladiator:Kampf,Rom,Arena,Schwert,Kolosseum|Mammut:Elefant,Eiszeit,Haare,ausgestorben,Stoßzähne|Kunstwerk:Bild,Künstler,Museum,malen,Gemälde" +
    "|Eiffelturm:Paris,Frankreich,Turm,hoch,Eisen|Brandenburger Tor:Berlin,Tor,Mauer,Säulen,Quadriga|Oktoberfest:München,Bier,Dirndl,Wiesn,Zelt" +
    "|Dirndl:Bayern,Kleid,Oktoberfest,Schürze,Tracht|Karneval:Köln,verkleiden,Kamelle,Umzug,Alaaf|Maske:Gesicht,verkleiden,verstecken,Fasching,aufsetzen" +
    "|Konfetti:bunt,Papier,werfen,Party,Schnipsel|Geschenkpapier:einpacken,Geschenk,bunt,Papier,Schleife|Kindergeburtstag:Kinder,Party,Kuchen,Spiele,Geschenke" +
    "|Spieleabend:Spiele,Freunde,Abend,Brettspiel,Karten|Weinprobe:Wein,probieren,trinken,Gläser,Sommelier|Rezept:kochen,Zutaten,Anleitung,Kochbuch,backen" +
    "|Schürze:Küche,kochen,tragen,dreckig,Vorderseite|Nudelholz:Teig,rollen,ausrollen,Holz,backen|Pfanne:braten,Herd,Öl,Küche,Spiegelei" +
    "|Löffel:Suppe,essen,Besteck,Gabel,Messer|Spülmaschine:Geschirr,sauber,Küche,abwaschen,einräumen|Abwasch:Geschirr,spülen,Wasser,Küche,Teller" +
    "|Lieferdienst:bestellen,Essen,bringen,Pizza,Lieferando|Diät:abnehmen,essen,Gewicht,weniger,Kalorien|Waage:Gewicht,Kilo,wiegen,abnehmen,Bad" +
    "|Kantine:Mittag,essen,Arbeit,Tablett,Schule|Hausschuhe:Pantoffeln,Füße,zu Hause,warm,Schuhe|Jeans:Hose,blau,Stoff,tragen,Denim" +
    "|Unterhose:Unterwäsche,Hose,tragen,darunter,Slip|Schnürsenkel:Schuhe,binden,Schleife,Band,Knoten|Knopf:Hemd,Loch,zumachen,rund,nähen" +
    "|Reißverschluss:Jacke,zumachen,ziehen,Hose,offen|Wolle:stricken,Schaf,Knäuel,weich,Faden|Pfandflasche:Pfand,zurückgeben,Flasche,Automat,Geld" +
    "|Überweisung:Bank,Geld,Konto,senden,IBAN|Geldautomat:Geld,Karte,abheben,PIN,Bank|Kreditkarte:bezahlen,Karte,Bank,Plastik,Geld" +
    "|Rabatt:Prozent,billiger,Preis,sparen,Angebot|Schlussverkauf:billig,Rabatt,Saison,Geschäft,Preise|Einkaufswagen:Supermarkt,schieben,Münze,Räder,einkaufen" +
    "|Briefmarke:Brief,kleben,Post,frankieren,sammeln|Vorstellungsgespräch:Job,Bewerbung,Chef,Fragen,Termin|Chef:Boss,Arbeit,Firma,Mitarbeiter,leiten" +
    "|Büro:Arbeit,Schreibtisch,Computer,Kollegen,Firma|Videokonferenz:Kamera,Zoom,Meeting,online,Bildschirm|Drucker:Papier,drucken,Tinte,Computer,ausdrucken" +
    "|Überstunden:Arbeit,länger,Feierabend,Stunden,Chef|Rente:alt,arbeiten,aufhören,Geld,Ruhestand|Mathe:rechnen,Zahlen,Schule,Lehrer,Plus" +
    "|Pause:Schule,Hof,klingeln,frei,kurz|Schultüte:Einschulung,Kind,Süßigkeiten,Schule,Tüte|Lineal:messen,Strich,gerade,Zentimeter,Schule" +
    "|Taschenrechner:rechnen,Mathe,Zahlen,Tasten,Ergebnis|Wörterbuch:Wörter,Sprache,übersetzen,nachschlagen,Buch|Abitur:Schule,Prüfung,Gymnasium,Abschluss,Abi" +
    "|Nachhilfe:lernen,Schule,Lehrer,schlechte,Noten|Smartwatch:Uhr,Handgelenk,Apple,Schritte,digital|Powerbank:Akku,laden,Handy,unterwegs,Strom" +
    "|Spielkonsole:spielen,PlayStation,Controller,Videospiel,Xbox|Joystick:Hebel,spielen,Videospiel,steuern,Controller|Streaming:Netflix,Film,Serie,Internet,schauen" +
    "|Hashtag:Raute,Instagram,Twitter,Wort,Zeichen|Spam:E-Mail,Werbung,Müll,unerwünscht,Postfach|Virus:krank,Computer,Grippe,anstecken,Corona" +
    "|Taschendieb:stehlen,Geldbörse,Dieb,Menge,klauen|Alarmanlage:Einbrecher,laut,Sirene,Haus,schützen|Handschellen:Polizei,verhaften,Hände,Metall,Gefangener" +
    "|Lupe:vergrößern,Glas,Detektiv,klein,sehen|Tatort:Krimi,Sonntag,Kommissar,Mord,Fernsehen|Rotkäppchen:Wolf,Großmutter,Korb,Märchen,rot" +
    "|Schneewittchen:Zwerge,Apfel,Märchen,Spiegel,sieben|Dornröschen:schlafen,hundert,Jahre,Prinz,Märchen|Sudoku:Zahlen,Rätsel,neun,Kästchen,Zeitung" +
    "|Horoskop:Sternzeichen,Zukunft,Zeitung,Sterne,Schicksal|Glücksbringer:Glück,Kleeblatt,Hufeisen,Schornsteinfeger,Talisman|Hufeisen:Pferd,Glück,Huf,Eisen,Schmied" +
    "|Freitag der Dreizehnte:Pech,Unglück,Aberglaube,Datum,Horror|Muskel:stark,Arm,Sport,trainieren,Bizeps|Gehirn:denken,Kopf,Organ,klug,Nerven" +
    "|Zunge:Mund,schmecken,rausstrecken,rot,lecken|Nase:riechen,Gesicht,Schnupfen,schnüffeln,Rüssel|Fingernagel:Finger,schneiden,Lack,kauen,Nagel" +
    "|Pupsen:Darm,Gestank,Luft,peinlich,Bohnen|Zungenbrecher:schwer,sprechen,schnell,Fischers Fritz,Satz|Flüstern:leise,Ohr,Geheimnis,sprechen,tuscheln" +
    "|Pfeifen:Mund,Lippen,Melodie,Ton,Schiedsrichter|Lampenfieber:aufgeregt,Bühne,Angst,nervös,Auftritt|Heimweh:Zuhause,vermissen,traurig,Familie,weg" +
    "|Eifersucht:neidisch,Partner,Liebe,Angst,eifersüchtig|Stolz:Erfolg,glücklich,geschafft,Brust,gut|Schadenfreude:lachen,Pech,anderer,freuen,gemein" +
    "|Vorfreude:freuen,bald,warten,Urlaub,Weihnachten|Geduld:warten,ruhig,lange,ungeduldig,Ausdauer|Chaos:Unordnung,durcheinander,Ordnung,Krach,wild" +
    "|Pünktlichkeit:Zeit,pünktlich,Termin,zu spät,Uhr|Wartezimmer:Arzt,warten,Praxis,Stühle,Zeitschrift|Stromausfall:dunkel,Strom,Licht,Kerzen,weg" +
    "|Frühjahrsputz:putzen,sauber,Frühling,Haus,aufräumen|Keller:unten,dunkel,Haus,Treppe,Lager|Balkon:draußen,Wohnung,Pflanzen,Geländer,sitzen" +
    "|Wohnzimmer:Sofa,Fernseher,Zimmer,Wohnung,gemütlich|Kinderzimmer:Kinder,Spielzeug,Zimmer,Bett,Chaos|Hütte:Holz,Berg,klein,Wald,Haus" +
    "|Leuchtreklame:Licht,Schild,Werbung,bunt,Nacht|Brunnen:Wasser,Platz,Münze,Stadt,sprudeln|Marktplatz:Stadt,Mitte,Markt,Rathaus,Platz" +
    "|Joghurt:Becher,Milch,Löffel,Kühlschrank,Frucht|Ketchup:Tomate,rot,Pommes,Flasche,Soße|Salz:streuen,würzen,salzig,weiß,Pfeffer" +
    "|Mehl:backen,Teig,weiß,Brot,Kuchen|Nutella:Schokolade,Brot,Nuss,Glas,süß|Pudding:Vanille,Schokolade,Dessert,süß,Löffel" +
    "|Torte:Kuchen,Sahne,Geburtstag,Stück,Hochzeit|Bonbon:süß,lutschen,Zucker,Papier,Hustenbonbon|Zuckerwatte:süß,Kirmes,rosa,Stab,flauschig" +
    "|Gebrannte Mandeln:Kirmes,süß,Nüsse,Zucker,Weihnachtsmarkt|Riesenrad:drehen,hoch,Kirmes,Gondel,Aussicht|Autoscooter:Kirmes,stoßen,fahren,Auto,rempeln" +
    "|Zebra:Streifen,schwarz,weiß,Pferd,Afrika|Känguru:springen,Beutel,Australien,hüpfen,Baby|Igel:Stacheln,Herbst,stechen,Garten,rollen" +
    "|Wolf:heulen,Rudel,Mond,Wald,Rotkäppchen|Maus:klein,Käse,piepsen,Katze,grau|Schildkröte:Panzer,langsam,alt,Reptil,Kröte" +
    "|Huhn:Ei,gackern,Hahn,Bauernhof,Federn|Schaf:Wolle,blöken,weiß,Herde,Lamm|Esel:grau,Ohren,störrisch,iah,tragen" +
    "|Gorilla:Affe,groß,stark,schwarz,Brust|Wal:Meer,groß,Säugetier,blasen,Fontäne|Qualle:Meer,glibberig,brennen,durchsichtig,Strand" +
    "|Mücke:stechen,summen,jucken,Sommer,Blut|Schnecke:langsam,Haus,Schleim,Salat,kriechen|Fledermaus:Nacht,fliegen,Höhle,hängen,Vampir" +
    "|Taube:Vogel,gurren,Stadt,Frieden,grau|Hamster:Käfig,Backen,Laufrad,Haustier,Nagetier|Hamburger:Brötchen,Fleisch,Fast Food,Käse,McDonald's" +
    "|Bratwurst:Grill,Senf,Wurst,Fleisch,Brötchen|Suppe:Löffel,heiß,Teller,Brühe,flüssig|Honig:Biene,süß,gelb,klebrig,Brot" +
    "|Butter:Brot,Fett,schmieren,gelb,Milch|Erdbeere:rot,Frucht,Sommer,Kuchen,süß|Ananas:gelb,Frucht,Pizza,Hawaii,stachelig" +
    "|Traube:Wein,grün,blau,Frucht,Rebe|Tomate:rot,Gemüse,Salat,Ketchup,Soße|Knoblauch:Vampir,riechen,Zehe,scharf,Atem" +
    "|Waffel:Teig,Muster,Eisen,süß,Puderzucker|Gummibärchen:Haribo,bunt,süß,Bär,Fruchtgummi|Kaugummi:kauen,Blase,kleben,Minze,Mund" +
    "|Limonade:süß,Zitrone,trinken,Sprudel,Getränk|Wein:rot,weiß,Traube,Alkohol,Glas|Kaffeemaschine:Kaffee,Bohnen,Küche,Tasse,Filter" +
    "|Bügeleisen:Wäsche,Falten,heiß,glatt,Hemd|Rasierer:Bart,Haare,Gesicht,Klinge,Mann|Handtuch:abtrocknen,nass,Bad,Strand,Stoff" +
    "|Kühlbox:kalt,Picknick,Camping,Getränke,Eis|Regal:Bücher,Bretter,Wand,IKEA,stellen|Tisch:essen,Beine,Stuhl,Platte,Möbel" +
    "|Zaun:Garten,Grenze,Latten,Nachbar,Tor|Hammer:Nagel,schlagen,Werkzeug,Holz,klopfen|Säge:Holz,sägen,Werkzeug,Zähne,schneiden" +
    "|Klebeband:kleben,Rolle,Tesa,Paket,durchsichtig|Steckdose:Strom,Stecker,Wand,Kabel,Elektrizität|Wäscheleine:Wäsche,trocknen,Klammer,aufhängen,Garten" +
    "|Rasenmäher:Gras,mähen,Garten,laut,schneiden|Gartenzwerg:Garten,Mütze,rot,Figur,klein|Bagger:Schaufel,graben,Baustelle,gelb,Erde" +
    "|Müllabfuhr:Müll,Tonne,Laster,abholen,orange|Pilot:Flugzeug,fliegen,Cockpit,Kapitän,Flughafen|Matrose:Schiff,Meer,Seemann,Hafen,Uniform" +
    "|Metzger:Fleisch,Wurst,schneiden,Messer,Theke|Krankenschwester:Krankenhaus,Pflege,Arzt,Patient,Spritze|Postbote:Briefe,Post,Pakete,bringen,Fahrrad" +
    "|Schauspieler:Film,Bühne,Rolle,spielen,Theater|Maler:malen,Pinsel,Farbe,Wand,Bild|Programmierer:Computer,Code,Software,tippen,Programm" +
    "|Hausmeister:Schule,reparieren,Haus,Schlüssel,kümmern|Restaurant:essen,Kellner,Speisekarte,Tisch,bestellen|Kneipe:Bier,trinken,Theke,Wirt,Abend" +
    "|Universität:studieren,Student,Vorlesung,Professor,Uni|Hafen:Schiffe,Meer,anlegen,Kai,Containern|Freizeitpark:Achterbahn,Karussell,Spaß,Eintritt,Fahrgeschäft" +
    "|Stadion:Fußball,Zuschauer,Spiel,Tribüne,Fans|Kreuzung:Ampel,Straße,abbiegen,Verkehr,kreuzen|Bus:Haltestelle,fahren,Fahrer,Linie,Ticket" +
    "|Motorrad:Helm,zwei,Räder,fahren,schnell|Kanu:paddeln,Fluss,Boot,Paddel,Wasser|Heißluftballon:Korb,fliegen,Luft,Feuer,Himmel" +
    "|Seilbahn:Berg,Gondel,Seil,hoch,Ski|Navi:Weg,Auto,Karte,Route,abbiegen|Fußgängerzone:Stadt,laufen,Geschäfte,einkaufen,Innenstadt" +
    "|Handball:Tor,werfen,Ball,Halle,Team|Golf:Schläger,Ball,Loch,Rasen,Abschlag|Reiten:Pferd,Sattel,Stall,Zügel,Turnier" +
    "|Klettern:Wand,Seil,hoch,Berg,Halle|Schlittschuh:Eis,laufen,Kufen,Winter,Halle|Darts:Pfeile,werfen,Scheibe,Kneipe,Punkte" +
    "|Kicker:Tischfußball,drehen,Stangen,Ball,Tor|Schiedsrichter:Pfeife,Spiel,Karte,Regeln,Fußball|Weltmeister:Titel,gewinnen,Turnier,beste,WM" +
    "|Torwart:Tor,halten,Fußball,Handschuhe,Ball|Gitarrist:Gitarre,spielen,Band,Saiten,Musik|Trompete:blasen,Blech,laut,Instrument,Jazz" +
    "|Mundharmonika:blasen,Mund,Instrument,Blues,klein|Chor:singen,Stimmen,Lied,Kirche,zusammen|Radio:hören,Sender,Musik,Moderator,Auto" +
    "|Decke:Bett,warm,zudecken,schlafen,Kuscheln|Puppe:Spielzeug,Kind,Barbie,Haare,spielen|Murmel:Glas,Kugel,rollen,spielen,bunt" +
    "|Brettspiel:Würfel,Figuren,Spielbrett,Monopoly,spielen|Mensch ärgere dich nicht:Würfel,Figuren,rausschmeißen,Brettspiel,ärgern|Fangen:rennen,Kinder,laufen,abklatschen,Spiel" +
    "|Hüpfburg:springen,Luft,Kinder,hüpfen,aufblasbar|Kuscheltier:weich,Teddy,Kind,schlafen,Plüsch|Windel:Baby,wechseln,voll,Popo,Pampers" +
    "|Zwillinge:zwei,gleich,Geschwister,Geburt,doppelt|Enkel:Oma,Opa,Familie,Kind,Großeltern|Taufe:Kirche,Baby,Wasser,Pate,Name" +
    "|Junggesellenabschied:Hochzeit,feiern,Freunde,letzte,Party|Scheidung:Ehe,trennen,Anwalt,Gericht,verheiratet|Valentinstag:Liebe,Februar,Rosen,Herz,verliebt" +
    "|Adventskalender:Türchen,Dezember,Schokolade,Weihnachten,öffnen|Weihnachtsmarkt:Glühwein,Buden,Dezember,Stände,Lebkuchen|Schneeflocke:Schnee,weiß,Winter,kalt,fallen" +
    "|Tornado:Wind,Sturm,drehen,Wirbel,Amerika|Flut:Wasser,Meer,Ebbe,steigen,Überschwemmung|Mondfinsternis:Mond,Schatten,Erde,dunkel,Sonne" +
    "|Komet:Schweif,Weltall,Stern,fliegen,Himmel|Fluss:Wasser,fließen,Ufer,Rhein,Strom|Welle:Meer,Wasser,surfen,hoch,Strand" +
    "|Palme:Strand,Kokosnuss,Baum,Urlaub,Süden|Blatt:Baum,grün,Herbst,fallen,Papier|Feld:Bauer,Acker,Getreide,Weizen,Traktor" +
    "|Rose:Blume,rot,Dornen,Liebe,duften|Unkraut:Garten,jäten,Pflanzen,wachsen,zupfen|Klee:Glück,vier,Blätter,Wiese,grün" +
    "|Kastanie:Herbst,braun,Baum,sammeln,stachelig|Zahnspange:Zähne,Draht,gerade,Kieferorthopäde,Metall|Spritze:Arzt,Nadel,impfen,piksen,Medikament" +
    "|Rollstuhl:Räder,sitzen,fahren,Behinderung,schieben|Glatze:Haare,Kopf,kahl,Mann,keine|Tattoo:Haut,Nadel,Bild,stechen,Farbe" +
    "|Ring:Finger,Schmuck,Hochzeit,Gold,rund|Armbanduhr:Uhr,Handgelenk,Zeit,tragen,Zeiger|Parfüm:riechen,Duft,sprühen,Flasche,gut" +
    "|Liegestuhl:Strand,liegen,Sonne,Urlaub,Pool|Luftmatratze:Wasser,aufblasen,liegen,schwimmen,Luft|Schnorchel:Luft,tauchen,Wasser,Rohr,atmen" +
    "|Souvenir:Urlaub,Andenken,kaufen,Erinnerung,Mitbringsel|Reisebüro:Urlaub,buchen,Reise,Katalog,Flug|Hängebrücke:Seil,wackeln,Schlucht,Brücke,schwanken" +
    "|Schatzkiste:Gold,Pirat,Schatz,Truhe,vergraben|Zaubertrank:Hexe,Kessel,trinken,Magie,brauen|Wahrsagerin:Zukunft,Karten,Kugel,vorhersagen,Hand" +
    "|Troll:Brücke,hässlich,Märchen,groß,Höhle|Zombie:untot,Gehirn,langsam,Horror,lebendig|Ninja:Japan,schwarz,Kampf,Schwert,lautlos" +
    "|Wikinger:Helm,Hörner,Schiff,Norden,Axt|Papst:Rom,Vatikan,Kirche,katholisch,weiß|Hofnarr:König,lustig,Mütze,Glöckchen,Witze" +
    "|Steinzeit:Höhle,Mammut,Feuer,früher,Neandertaler|Mona Lisa:Bild,lächeln,Leonardo,Louvre,Gemälde|Freiheitsstatue:New York,Fackel,Amerika,grün,Statue" +
    "|Berliner Mauer:Berlin,DDR,Grenze,Fall,1989|Lederhose:Bayern,Hose,Leder,Tracht,Oktoberfest|Kostüm:verkleiden,Fasching,anziehen,Maske,Karneval" +
    "|Girlande:Party,aufhängen,bunt,Deko,Geburtstag|Pyjamaparty:übernachten,Freunde,Schlafanzug,Kinder,Nacht|Grillparty:Grill,Würstchen,Sommer,Garten,Freunde" +
    "|Kochkurs:kochen,lernen,Rezept,Küche,Koch|Kochbuch:Rezepte,kochen,Buch,Küche,Seiten|Schneebesen:schlagen,Sahne,Küche,Rührbesen,Eier" +
    "|Messer:schneiden,scharf,Klinge,Besteck,Gabel|Teller:essen,Geschirr,Tisch,Besteck,flach|Tiefkühlpizza:Pizza,gefroren,Ofen,Supermarkt,schnell" +
    "|Fast Food:schnell,Burger,Pommes,ungesund,McDonald's|Vegetarier:Fleisch,kein,Gemüse,essen,vegan|Mittagsschlaf:schlafen,Mittag,Nickerchen,müde,kurz" +
    "|Wollmütze:Kopf,Winter,warm,stricken,Mütze|Schuhe:Füße,laufen,Schnürsenkel,tragen,Paar|Gürtel:Hose,Schnalle,Leder,Bauch,halten" +
    "|Nähmaschine:nähen,Stoff,Faden,Nadel,Kleid|Mülltrennung:Müll,gelber Sack,Recycling,sortieren,Tonne|Steuererklärung:Finanzamt,Steuern,Formular,Geld,Jahr" +
    "|Sparschwein:sparen,Münzen,Geld,Schwein,Kind|Kasse:bezahlen,Supermarkt,Geld,Bon,Kassierer|Quittung:Bon,Kasse,bezahlen,Beleg,Papier" +
    "|Paket:Post,verschicken,Karton,liefern,DHL|Bewerbung:Job,Lebenslauf,schreiben,Firma,Stelle|Kollege:Arbeit,Büro,zusammen,Firma,Team" +
    "|Homeoffice:zu Hause,arbeiten,Laptop,Büro,Videokonferenz|Kaffeepause:Kaffee,Arbeit,Pause,Kollegen,kurz|Urlaubsantrag:Urlaub,Chef,frei,Formular,Tage" +
    "|Ruhestand:Rente,alt,Arbeit,aufhören,Pension|Klassenfahrt:Schule,Ausflug,Lehrer,Reise,Jugendherberge|Radiergummi:Bleistift,löschen,Fehler,radieren,Gummi" +
    "|Globus:Erde,Kugel,Weltkarte,drehen,Länder|Diktat:schreiben,Schule,Rechtschreibung,Lehrer,Fehler|Spickzettel:Prüfung,schummeln,Zettel,verstecken,Test" +
    "|Ladekabel:Handy,Akku,laden,Stecker,Strom|Drohne:fliegen,Kamera,Fernsteuerung,Propeller,Luft|Fernbedienung:Fernseher,Knöpfe,umschalten,Sofa,Batterien" +
    "|Podcast:hören,Folge,sprechen,Audio,Spotify|Influencer:Instagram,Follower,Werbung,YouTube,Social Media|Update:neu,Software,aktualisieren,Handy,Version" +
    "|Einbrecher:Dieb,Haus,stehlen,Nacht,einbrechen|Fingerabdruck:Finger,Spur,Polizei,Verbrecher,Muster|Krimi:Mord,Detektiv,Buch,Tatort,Kommissar" +
    "|Märchen:Es war einmal,Grimm,Prinzessin,erzählen,Geschichte|Aschenputtel:Schuh,Ball,Prinz,Märchen,Stiefmutter|Hänsel und Gretel:Hexe,Lebkuchenhaus,Wald,Märchen,Geschwister" +
    "|Sternzeichen:Horoskop,Geburtstag,Widder,Löwe,Sterne|Schornsteinfeger:Glück,schwarz,Kamin,Ruß,Zylinder|Aberglaube:schwarze Katze,Freitag,Glück,Pech,glauben" +
    "|Herz:schlagen,Liebe,Organ,Blut,rot|Knochen:Skelett,Hund,brechen,hart,Körper|Daumen:Finger,hoch,Hand,dick,Daumen drücken" +
    "|Bauchnabel:Bauch,Loch,Nabelschnur,Mitte,Baby|Rülpsen:Bauch,Luft,laut,Bier,Mund|Schreien:laut,rufen,Stimme,brüllen,wütend" +
    "|Applaus:klatschen,Hände,Publikum,Bühne,Beifall|Fernweh:Reise,weg,Sehnsucht,Urlaub,Ferne|Wut:sauer,böse,ärgern,rot,schreien" +
    "|Peinlich:schämen,rot,Situation,unangenehm,Fremdschämen|Neugier:wissen,Fragen,neugierig,Katze,interessiert|Ordnung:aufräumen,Chaos,ordentlich,sauber,Platz" +
    "|Verspätung:spät,Bahn,warten,Zug,pünktlich|Warteschlange:anstehen,warten,Schlange,Reihe,Kasse|Kater:Bier,Alkohol,Kopfschmerzen,Morgen,Katze" +
    "|Dachboden:oben,Haus,Speicher,Kisten,staubig|Garage:Auto,parken,Tor,Haus,Werkzeug|Hochhaus:hoch,Stockwerke,Stadt,Aufzug,Wohnungen" +
    "|Baumhaus:Baum,Holz,Kinder,klettern,Leiter|Denkmal:Statue,erinnern,Platz,Stein,Bronze|Spaziergang:laufen,Park,gehen,Hund,frische Luft" +
    "|Senf:gelb,Wurst,scharf,Tube,Bratwurst|Zucker:süß,weiß,Würfel,Kaffee,backen|Reis:Körner,China,kochen,weiß,Sushi" +
    "|Croissant:Frankreich,Hörnchen,Frühstück,Butter,Bäcker|Sahne:Kuh,Milch,schlagen,weiß,Kuchen|Mandarine:orange,schälen,Weihnachten,Frucht,klein" +
    "|Karussell:drehen,Kirmes,Pferde,Kinder,Runde|Geisterbahn:gruseln,Kirmes,Angst,fahren,Monster|Losbude:Kirmes,ziehen,Gewinn,Niete,Preis" +
    "|Panda:China,Bambus,schwarz,weiß,Bär|Flamingo:rosa,Bein,Vogel,stehen,Wasser|Pfau:Federn,Rad,bunt,Vogel,stolz" +
    "|Strauß:Vogel,groß,laufen,Kopf,Sand|Specht:Baum,klopfen,Vogel,Schnabel,Loch|Möwe:Meer,Vogel,Strand,Pommes,kreischen" +
    "|Ente:quaken,Teich,Vogel,schwimmen,Donald|Gans:Martinstag,Vogel,schnattern,Braten,weiß|Hirsch:Geweih,Wald,röhren,Reh,Jäger" +
    "|Reh:Wald,Bambi,scheu,braun,Kitz|Wildschwein:Wald,Borsten,Hauer,Frischling,grunzen|Biber:Damm,Zähne,Holz,Fluss,nagen" +
    "|Otter:Wasser,Fluss,schwimmen,Fisch,Fell|Robbe:Meer,Eis,Seehund,Flossen,Fisch|Eisbär:weiß,Nordpol,Eis,Bär,kalt" +
    "|Faultier:langsam,hängen,Baum,schlafen,faul|Chamäleon:Farbe,wechseln,Zunge,Echse,tarnen|Skorpion:Stachel,giftig,Wüste,Schwanz,Zangen" +
    "|Hummer:Meer,rot,Scheren,teuer,kochen|Krabbe:Strand,seitwärts,Scheren,Meer,Krebs|Libelle:Flügel,Wasser,Insekt,fliegen,schnell" +
    "|Glühwürmchen:leuchten,Nacht,Käfer,Licht,Sommer|Raupe:Schmetterling,grün,Blatt,fressen,kriechen|Wespe:stechen,gelb,schwarz,Kuchen,Sommer" +
    "|Hummel:dick,summen,Biene,pelzig,Blume|Pudel:Hund,Locken,Frisur,weiß,Rasse|Dackel:Hund,kurz,Beine,lang,Wurst" +
    "|Kuckuck:Uhr,Vogel,Ei,rufen,Wald|Rabe:schwarz,Vogel,krächzen,Krähe,klug|Spatz:Vogel,klein,braun,Dach,piepsen" +
    "|Nachtigall:singen,Vogel,Nacht,schön,Lied|Brokkoli:grün,Gemüse,Röschen,gesund,Baum|Spinat:grün,Popeye,Gemüse,Blätter,Eisen" +
    "|Paprika:rot,gelb,grün,Gemüse,Schote|Mais:gelb,Kolben,Popcorn,Feld,Körner|Erbse:grün,klein,Schote,Prinzessin,Gemüse" +
    "|Linsen:Suppe,Hülsenfrucht,klein,braun,Spätzle|Spätzle:Schwaben,Nudeln,Käse,Teig,Linsen|Knödel:Kloß,Kartoffel,Bayern,rund,Soße" +
    "|Schnitzel:Fleisch,paniert,Wien,Pommes,klopfen|Currywurst:Wurst,Soße,Berlin,Pommes,Imbiss|Lasagne:Nudeln,Schichten,Italien,Käse,Ofen" +
    "|Risotto:Reis,Italien,cremig,Parmesan,rühren|Taco:Mexiko,Fladen,Fleisch,scharf,knusprig|Nachos:Mexiko,Käse,Chips,Dip,Kino" +
    "|Chips:knusprig,Kartoffel,Tüte,salzig,Sofa|Erdnuss:Nuss,Schale,Butter,Allergie,salzig|Toast:Brot,Toaster,Scheibe,knusprig,Frühstück" +
    "|Sandwich:Brot,belegt,Scheiben,Käse,Schinken|Brot:Bäcker,Scheibe,backen,Mehl,Laib|Schinken:Schwein,Fleisch,Scheibe,Brot,Wurst" +
    "|Würstchen:Wurst,Senf,heiß,Wiener,Grill|Fischstäbchen:Fisch,paniert,Käpt'n Iglu,Tiefkühl,Kinder|Muffin:Kuchen,klein,Schokolade,Förmchen,backen" +
    "|Donut:Loch,süß,Glasur,Homer,rund|Keks:backen,Plätzchen,süß,knusprig,Dose|Plätzchen:Weihnachten,backen,Keks,Ausstecher,Teig" +
    "|Zimtschnecke:Zimt,Schweden,Hefe,süß,gerollt|Apfelstrudel:Apfel,Österreich,Teig,Vanillesoße,Wien|Eiskaffee:Kaffee,Eis,Sahne,kalt,Sommer" +
    "|Kakao:Schokolade,trinken,warm,Milch,braun|Milchshake:Milch,Eis,Strohhalm,süß,mixen|Smoothie:Obst,mixen,trinken,gesund,Mixer" +
    "|Strohhalm:trinken,saugen,Plastik,Glas,Röhrchen|Thermoskanne:warm,Kaffee,Tee,halten,Flasche|Brotdose:Schule,Pause,essen,Box,Butterbrot" +
    "|Kühlschrankmagnet:Magnet,Kühlschrank,Souvenir,kleben,Tür|Salzstreuer:Salz,streuen,Tisch,Pfeffer,Löcher|Korkenzieher:Wein,Flasche,öffnen,drehen,Korken" +
    "|Dosenöffner:Dose,öffnen,Konserve,Küche,Werkzeug|Mixer:mixen,Küche,Smoothie,Messer,laut|Waffeleisen:Waffeln,backen,Teig,heiß,Herz" +
    "|Eiswürfel:kalt,Wasser,gefroren,Getränk,Würfel|Gefriertruhe:kalt,einfrieren,Keller,Eis,Tiefkühl|Taschentuch:Nase,putzen,Schnupfen,Tempo,Papier" +
    "|Klopapier:Toilette,Rolle,Papier,Hamsterkauf,weich|Wäschekorb:Wäsche,dreckig,Korb,Kleidung,sammeln|Staubwedel:Staub,putzen,Federn,wischen,Regal" +
    "|Wischmopp:Boden,wischen,nass,Eimer,putzen|Kehrblech:Besen,Schaufel,fegen,Dreck,Boden|Spinnennetz:Spinne,Faden,kleben,Ecke,fangen" +
    "|Mausefalle:Maus,Käse,fangen,schnappen,Falle|Bilderrahmen:Foto,Wand,Glas,aufhängen,Bild|Wanduhr:Zeit,Wand,ticken,Zeiger,hängen" +
    "|Sanduhr:Sand,Zeit,umdrehen,Glas,rieseln|Kuckucksuhr:Schwarzwald,Vogel,Uhr,rufen,Holz|Schaukelstuhl:schaukeln,sitzen,Oma,Holz,wippen" +
    "|Kamin:Feuer,Holz,warm,Wohnzimmer,Schornstein|Heizung:warm,Winter,Wärme,aufdrehen,Thermostat|Ventilator:Wind,kühl,Sommer,drehen,Luft" +
    "|Klimaanlage:kalt,kühlen,Sommer,Luft,Auto|Rauchmelder:Rauch,Feuer,piepen,Decke,Alarm|Feuerlöscher:Feuer,löschen,rot,Schaum,Notfall" +
    "|Erste Hilfe:Notfall,helfen,Verband,Unfall,Kurs|Notruf:112,anrufen,Hilfe,Polizei,Feuerwehr|Wetterhahn:Dach,Wind,Hahn,Richtung,drehen" +
    "|Regenrinne:Dach,Wasser,Rinne,Regen,Laub|Gartenschlauch:Wasser,Garten,spritzen,gießen,grün|Planschbecken:Wasser,Kinder,Sommer,aufblasen,Garten" +
    "|Swimmingpool:Wasser,schwimmen,Garten,Becken,Sommer|Rutschbahn:rutschen,Spielplatz,Kinder,runter,Wasser|Wippe:Spielplatz,auf,ab,zwei,Kinder" +
    "|Klettergerüst:Spielplatz,klettern,Kinder,Stangen,hoch|Kettenkarussell:Kirmes,drehen,Ketten,fliegen,Sitze|Bauchredner:Puppe,sprechen,Mund,Stimme,Bühne" +
    "|Jongleur:Bälle,werfen,Zirkus,fangen,Keulen|Seiltänzer:Seil,balancieren,Zirkus,hoch,Stange|Feuerspucker:Feuer,Mund,spucken,Zirkus,Fackel" +
    "|Dompteur:Zirkus,Löwen,Peitsche,Tiere,Manege|Marionette:Fäden,Puppe,Theater,ziehen,Holz|Kasperle:Puppentheater,Krokodil,Kinder,Handpuppe,Theater" +
    "|Comic:Bilder,Sprechblase,Heft,lesen,Superheld|Zeichentrickfilm:Disney,Film,gezeichnet,Kinder,animiert|Fernsehserie:Folgen,Staffel,schauen,Netflix,Fernsehen" +
    "|Nachrichten:Tagesschau,Fernsehen,aktuell,Sprecher,Welt|Werbung:Pause,Fernsehen,kaufen,Produkt,Spot|Quizshow:Fragen,Kandidat,Fernsehen,gewinnen,Moderator" +
    "|Kochshow:kochen,Fernsehen,Koch,Rezept,Studio|Talkshow:Gäste,reden,Fernsehen,Moderator,Sofa|Wetterkarte:Wetter,Karte,Sonne,Regen,Fernsehen" +
    "|Kinokarte:Kino,Film,Ticket,Platz,kaufen|Premiere:erste,Film,roter Teppich,Stars,Aufführung|Roter Teppich:Stars,Premiere,laufen,Fotografen,rot" +
    "|Autogramm:unterschreiben,Star,Fan,Name,Stift|Fan:Star,Verein,lieben,jubeln,Anhänger|Paparazzi:Fotografen,Stars,heimlich,Fotos,verfolgen" +
    "|Oscar:Preis,Film,Hollywood,Statue,gold|Hollywood:Film,Stars,Los Angeles,Kino,Schild|Bestseller:Buch,verkauft,viel,Liste,beliebt" +
    "|Hörbuch:hören,Buch,vorlesen,Sprecher,Audio|Gedicht:Reim,Vers,Strophe,Dichter,schreiben|Rätsel:lösen,raten,Frage,Antwort,knifflig" +
    "|Puzzleteil:Puzzle,Teil,passen,fehlen,Bild|Zauberwort:bitte,Magie,sagen,Abrakadabra,höflich|Abrakadabra:Zauberer,Spruch,Magie,zaubern,Wort" +
    "|Fluch:verfluchen,Hexe,böse,Zauber,Pech|Kobold:klein,grün,Pumuckl,frech,Gold|Gnom:klein,Zwerg,Garten,Erde,Mütze" +
    "|Phönix:Vogel,Feuer,Asche,auferstehen,Harry Potter|Greif:Adler,Löwe,Fabelwesen,Flügel,Krallen|Zyklop:Auge,eins,Riese,Odysseus,Mythos" +
    "|Medusa:Schlangen,Haare,Stein,Mythos,Blick|Herkules:stark,Held,Mythos,Griechenland,Aufgaben|Atlantis:versunken,Stadt,Meer,Legende,Insel" +
    "|Schatzkarte:Kreuz,Schatz,Pirat,Weg,graben"
  ).split("|").map(z => { const [w, rest] = z.split(":"); return { w: w.trim(), tabu: rest.split(",").map(s => s.trim()) }; });

  // Pantomime: eigene Begriffe, die man gut vorspielen kann (Tätigkeiten, Sport, Berufe, Tiere, Figuren, Szenen), getrennt mit „|“
  const PANTOMIME = (
    "Zähne putzen|Haare föhnen|Krawatte binden|Schuhe binden|Fenster putzen|Staubsaugen|Wäsche bügeln|Wäsche aufhängen|Geschirr spülen|" +
    "Zwiebeln schneiden|Pfannkuchen wenden|Teig kneten|Pizza belegen|Kaffee kochen|Brot schmieren|Ei aufschlagen|Einkaufswagen schieben|" +
    "Rasen mähen|Blumen gießen|Unkraut jäten|Schnee schippen|Auto waschen|Reifen wechseln|Koffer packen|Bett beziehen|Wecker ausschalten|" +
    "Verschlafen|Schminken|Rasieren|Nägel lackieren|Duschen|Windeln wechseln|Kinderwagen schieben|Baby in den Schlaf wiegen|Geschenk einpacken|" +
    "Brief schreiben|Selfie machen|Telefonieren|Nachricht tippen|Fernbedienung suchen|Kerzen auspusten|Luftballon aufblasen|Kaugummiblase|" +
    "Spaghetti essen|Eis schlecken|Suppe auslöffeln|Mit Stäbchen essen|In eine Zitrone beißen|Scharfes Essen|Heiße Kartoffel|Glühbirne wechseln|" +
    "Bild aufhängen|Schrank aufbauen|Nagel einschlagen|Wand streichen|Tapezieren|Müll rausbringen|Hund ausführen|Katze streicheln|Fische füttern|" +
    "Brille putzen|Kontaktlinse suchen|Schlüssel suchen|Tür aufschließen|Kaugummi unterm Schuh|Spinne im Bad|Mücke jagen|Fliege fangen|" +
    "Niesen|Gähnen|Schnarchen|Schluckauf|Schlafwandeln|Albtraum|Muskelkater|Hexenschuss|Zahnschmerzen|Sonnenbrand|Mückenstich|Gänsehaut|" +
    "Lampenfieber|Verliebt sein|Langeweile|Ungeduld|Höhenangst|Seekrank|Kopfschmerzen|Frieren|Schwitzen|Kitzeln|Lachkrampf|" +
    "Bowling|Golf|Tennis|Tischtennis|Boxen|Gewichtheben|Seilspringen|Hula-Hoop|Yoga|Surfen|Skifahren|Snowboarden|Schlittschuhlaufen|Rudern|" +
    "Kanu fahren|Tauchen|Brustschwimmen|Turmspringen|Klettern|Reiten|Fechten|Bogenschießen|Basketball|Volleyball|Elfmeter|Kugelstoßen|" +
    "Speerwerfen|Hochsprung|Hürdenlauf|Billard|Darts|Angeln|Eishockey|Handstand|Purzelbaum|Radfahren|Rollschuh fahren|Skateboard fahren|" +
    "Trampolin springen|Limbo|Tauziehen|Sackhüpfen|Eierlauf|Schneeballschlacht|Schneemann bauen|Sandburg bauen|Drachen steigen lassen|" +
    "Wandern|Joggen|Liegestütze|Kopfball|Curling|Minigolf|Federball|Bungee-Sprung|Fallschirmspringen|Wasserski|Rodeo|" +
    "Friseur|Zahnarzt|Feuerwehrmann|Verkehrspolizist|Dirigent|Pilot|Kellner|Koch|Maler|Bauarbeiter|Gärtner|Fotograf|Zauberer|Clown|Bäcker|" +
    "Fischer|Holzfäller|Schornsteinfeger|Postbote|Taxifahrer|Busfahrer|Chirurg|Tierarzt|Bademeister|Schiedsrichter|Ballerina|DJ|Rockstar|" +
    "Opernsängerin|Bodybuilder|Model auf dem Laufsteg|Astronaut|Detektiv|Kassiererin|Straßenmusiker|Wahrsagerin|Jongleur|Seiltänzerin|" +
    "Dompteur|Bauchredner|Imker|Butler|Nachrichtensprecher|Barkeeper|Einweiser am Flughafen|Melken|" +
    "Affe|Elefant|Pinguin|Känguru|Giraffe|Krokodil|Schlange|Hase|Frosch|Huhn|Kuh|Pferd|Esel|Schwein|Gorilla|Bär|Eichhörnchen|Specht|" +
    "Flamingo|Krake|Robbe|Hai|Schmetterling|Raupe|Spinne|Schnecke|Biene|Fledermaus|Eule|Truthahn|Delfin|Löwe|Faultier|Kamel|Igel|Maulwurf|" +
    "Storch|Krebs|Papagei|Pfau|Seepferdchen|Qualle|Dinosaurier|Hund|Katze|" +
    "Gitarre spielen|Schlagzeug spielen|Klavier spielen|Geige spielen|Trompete spielen|Harfe spielen|Akkordeon spielen|Triangel|Querflöte|" +
    "Kontrabass|Dudelsack|Luftgitarre|Karaoke|Mundharmonika|" +
    "Roboter|Zombie|Vampir|Mumie|Gespenst|Hexe auf dem Besen|Superheld|Marionette|Statue|Ritter|Pirat|Cowboy|Meerjungfrau|Riese|Zwerg|" +
    "Drache|Einhorn|Werwolf|Hase aus dem Hut|Prinzessin auf der Erbse|Dornröschen|Rotkäppchen|Froschkönig|Rapunzel|Aschenputtel|Pinocchio|" +
    "Weihnachtsmann|Osterhase|Außerirdischer|Geist aus der Flasche|" +
    "Achterbahn|Karussell|Autoscooter|Riesenrad|Geisterbahn|Heiratsantrag|Hochzeitstanz|Kindergeburtstag|Stau|Einparken|Tanken|" +
    "Turbulenzen|Bus verpassen|Im Aufzug stecken|Auf Glatteis ausrutschen|Stromausfall|Die Tür klemmt|Zelt aufbauen|Lagerfeuer|" +
    "Marshmallows grillen|Grillen|Picknick|Sonnenbaden|Eincremen|Schatzsuche|Verstecken spielen|Blinde Kuh|Seifenblasen|Papierflieger|" +
    "Kartenhaus bauen|Puzzle legen|Schach spielen|Würfeln|Rubbellos|Kino mit Popcorn|Gruselfilm|Shoppen|Kleider anprobieren|Rolltreppe|" +
    "Drehtür|Unsichtbare Wand|Gegen den Wind laufen|Moonwalk|Breakdance|Tango|Walzer|Polonaise|Bauchtanz|Cocktail mixen|Sekt öffnen|" +
    "Bier zapfen|Anstoßen|Weinprobe|Hypnose|Meditation|Massage|" +
    "Weihnachtsbaum schmücken|Plätzchen backen|Schlitten fahren|Rentier|Lichterkette entwirren|Glühwein trinken|Adventskranz anzünden|" +
    "Eisstockschießen|Silvesterrakete|Wunderkerze|Schneeengel|Kamin anzünden|Geschenke auspacken|Ostereier suchen|Ostereier bemalen|" +
    "Kürbis schnitzen|Laternenumzug|Kamelle werfen|Konfetti werfen|Torte ins Gesicht|" +
    "Regenschirm|Fernglas|Taschenlampe|Bohrmaschine|Kettensäge|Leiter|Schubkarre|Fegen|Nähmaschine|Stricken|Lasso|Lupe|Kopfhörer|VR-Brille|" +
    "Spiegel|Rucksack|Hängematte|Schaukel|Wippe|Rutsche|Fliegenklatsche|Fahrradpumpe|Korkenzieher|Dosenöffner|Zahnseide|Mikroskop|Bagger|" +
    "Presslufthammer|Rasensprenger|Feuerlöscher|Wasserpistole|Jo-Jo|Bumerang|Frisbee|Schnorchel"
  ).split("|").map(w => ({ w: w.trim(), tabu: [] }));

  const ZEITEN = [60, 90, 120];
  const DURCHGAENGE = [1, 2];
  const ARTEN = ["erklaeren", "zeichnen", "pantomime"];
  const ART_NAME = { erklaeren: "Erklären", zeichnen: "Zeichnen", pantomime: "Pantomime" };
  const MODI = ["erklaeren", "pantomime", "gemischt"];
  const MODUS_NAME = { erklaeren: "Erklären", pantomime: "Pantomime", gemischt: "Gemischt" };
  // Ältere Spielstände kennen nur „gemischt: ja/nein“
  const modus = S => MODI.includes(S.modus) ? S.modus : S.gemischt ? "gemischt" : "erklaeren";
  // Pantomime zieht aus eigenen Begriffen, Erklären und Zeichnen aus den Karten
  const stapelName = art => art === "pantomime" ? "stapelP" : "stapel";
  const vorrat = art => art === "pantomime" ? PANTOMIME : KARTEN;
  const TEAMS = [{ name: "Füchse", zeichen: "🦊" }, { name: "Eulen", zeichen: "🦉" }];
  const MAX_PUNKTE = 4000;
  const kopie = x => JSON.parse(JSON.stringify(x));

  function neu(code, hostPid, hostName, einst) {
    einst = einst || {};
    return {
      v: 1, spiel: "wortverbot", code, epoch: 0, host: hostPid, phase: "lobby",
      zeit: ZEITEN.includes(+einst.zeit) ? +einst.zeit : 90,
      durchgaenge: DURCHGAENGE.includes(+einst.durchgaenge) ? +einst.durchgaenge : 1,
      modus: MODI.includes(einst.modus) ? einst.modus : einst.gemischt ? "gemischt" : "erklaeren",
      spieler: { [hostPid]: { name: hostName } }, reihenfolge: [hostPid], team: { [hostPid]: 0 },
      punkte: [0, 0], zug: -1, zuege: 0, dran: [0, 0], erklaerer: null, teamDran: 0, art: "erklaeren",
      rest: null, k: 0, karte: null, karten: [], stapel: [], stapelP: [], verlauf: [], weg: 0, aenderung: Date.now()
    };
  }

  const mitglieder = (S, t) => S.reihenfolge.filter(p => S.spieler[p] && S.team[p] === t);
  const da = (S, p) => (S.online || []).includes(p);
  function kleineresTeam(S) {
    const a = mitglieder(S, 0).length, b = mitglieder(S, 1).length;
    return a <= b ? 0 : 1;
  }
  // Punkte aus allen Karten: richtig = Punkt fürs erklärende Team, erwischt = Punkt fürs andere
  function zaehlen(S) {
    const p = [0, 0];
    const z = (team, karten) => { for (const k of karten) { if (k.e === "richtig") p[team] += 1; else if (k.e === "erwischt") p[1 - team] += 1; } };
    for (const v of S.verlauf) z(v.team, v.karten);
    if (S.phase === "spielen") z(S.teamDran, S.karten);
    S.punkte = p;
  }
  // Wer erklärt im Team t als Nächstes: reihum, wer gerade nicht da ist, wird übersprungen
  function erklaererWaehlen(S, t) {
    const m = mitglieder(S, t); if (!m.length) return null;
    for (let i = 0; i < m.length; i++) {
      const p = m[(S.dran[t] + i) % m.length];
      if (da(S, p)) { S.dran[t] = (S.dran[t] + i) % m.length; return p; }
    }
    return m[S.dran[t] % m.length];
  }
  function naechsterZug(S) {
    S.zug += 1; S.karte = null; S.karten = []; S.weg = 0; S.rest = null; S.k += 1;
    if (S.zug >= S.zuege) { S.phase = "ende"; S.erklaerer = null; return; }
    S.teamDran = S.zug % 2;
    const runde = Math.floor(S.zug / 2);
    const m = modus(S);
    S.art = m === "gemischt" ? ARTEN[runde % 3] : m;
    S.erklaerer = erklaererWaehlen(S, S.teamDran);
    S.phase = "bereit";
  }
  function karteZiehen(S) {
    const liste = vorrat(S.art), n = stapelName(S.art);
    if (!Array.isArray(S[n])) S[n] = [];
    let frei = liste.map((_, i) => i).filter(i => !S[n].includes(i));
    if (!frei.length) { S[n] = []; frei = liste.map((_, i) => i); }
    const i = frei[Math.floor(Math.random() * frei.length)];
    S[n].push(i); S.karte = i; S.k += 1;
  }
  function zugBeenden(S) {
    S.verlauf.push({ zug: S.zug, team: S.teamDran, erklaerer: S.erklaerer, art: S.art, karten: S.karten });
    S.karten = []; S.karte = null;
    naechsterZug(S);
    zaehlen(S);
  }
  function karteErledigt(S, e, von) {
    const eintrag = { w: vorrat(S.art)[S.karte].w, e };
    if (von) eintrag.von = von;
    S.karten.push(eintrag);
    karteZiehen(S);
    zaehlen(S);
  }

  // Jede Sekunde beim Spielleiter
  function tick(S0) {
    if (!["bereit", "spielen"].includes(S0.phase)) return S0;
    const S = kopie(S0), erklaererDa = da(S, S.erklaerer);
    S.weg = erklaererDa ? 0 : S.weg + 1;
    if (S.phase === "bereit") {
      if (S.weg === S0.weg) return S0;
      // Ist der Erklärer weg, kommt der Nächste aus seinem Team dran
      if (S.weg >= 6 && mitglieder(S, S.teamDran).some(p => p !== S.erklaerer && da(S, p))) {
        S.dran[S.teamDran] += 1; S.erklaerer = erklaererWaehlen(S, S.teamDran); S.weg = 0;
      }
    } else {
      S.rest -= 1;
      if (S.rest <= 0 || S.weg >= 15) zugBeenden(S);
    }
    return S;
  }

  // Aktion anwenden: {ok, S, fehler, ergebnis}
  function aktion(S0, pid, m) {
    const S = kopie(S0), istHost = pid === S.host, nein = fehler => ({ ok: false, S: S0, fehler });
    switch (m.t) {
      case "hallo": case "join": {
        const name = String(m.name || "").trim().slice(0, 20) || "Gast";
        if (!S.spieler[pid]) { S.spieler[pid] = { name }; S.reihenfolge.push(pid); S.team[pid] = kleineresTeam(S); }
        else S.spieler[pid].name = name;
        if (S.team[pid] === undefined) S.team[pid] = kleineresTeam(S);
        break;
      }
      case "einstellungen":
        if (!istHost || S.phase !== "lobby") return nein("Nur der Spielleiter stellt das Spiel ein.");
        if (ZEITEN.includes(+m.zeit)) S.zeit = +m.zeit;
        if (DURCHGAENGE.includes(+m.durchgaenge)) S.durchgaenge = +m.durchgaenge;
        if (MODI.includes(m.modus)) { S.modus = m.modus; delete S.gemischt; }
        else if (typeof m.gemischt === "boolean") { S.modus = m.gemischt ? "gemischt" : "erklaeren"; delete S.gemischt; }
        break;
      case "team": {
        if (S.phase !== "lobby") return nein("Teams nur vor dem Spiel ändern.");
        if (!istHost && m.p !== pid) return nein("Nur der Spielleiter verteilt die anderen.");
        if (!S.spieler[m.p]) return nein("Unbekannt.");
        S.team[m.p] = 1 - (S.team[m.p] || 0);
        break;
      }
      case "mischen": {
        if (!istHost || S.phase !== "lobby") return nein("Nur der Spielleiter.");
        const alle = S.reihenfolge.filter(p => S.spieler[p]), anwesend = alle.filter(p => da(S, p)), weg = alle.filter(p => !da(S, p));
        for (let i = anwesend.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [anwesend[i], anwesend[j]] = [anwesend[j], anwesend[i]]; }
        const start = Math.random() < 0.5 ? 0 : 1;
        anwesend.forEach((p, i) => { S.team[p] = (i + start) % 2; });
        weg.forEach(p => { S.team[p] = kleineresTeam(S); });
        break;
      }
      case "start": {
        if (!istHost || S.phase !== "lobby") return nein("Nur der Spielleiter startet.");
        const a = mitglieder(S, 0).filter(p => da(S, p)).length, b = mitglieder(S, 1).filter(p => da(S, p)).length;
        if (a < 2 || b < 2) return nein("Jedes Team braucht mindestens zwei.");
        // Jeder ist mindestens durchgaenge-mal dran; gemischt mindestens drei Runden, damit jede Art einmal vorkommt
        S.zuege = 2 * Math.max(Math.max(a, b) * S.durchgaenge, modus(S) === "gemischt" ? 3 : 1);
        S.zug = -1; S.verlauf = []; S.punkte = [0, 0]; S.karten = [];
        S.dran = [Math.floor(Math.random() * a), Math.floor(Math.random() * b)];
        naechsterZug(S);
        break;
      }
      case "los":
        if (S.phase !== "bereit") return nein("Gerade nicht.");
        if (pid !== S.erklaerer) return nein("Das macht " + ((S.spieler[S.erklaerer] || {}).name || "der Erklärer") + ".");
        S.phase = "spielen"; S.rest = S.zeit; S.karten = []; S.weg = 0;
        karteZiehen(S);
        break;
      case "richtig": case "weiter":
        if (S.phase !== "spielen" || m.k !== S.k) return nein("Zu spät.");
        if (pid !== S.erklaerer) return nein("Das macht der Erklärer.");
        karteErledigt(S, m.t === "richtig" ? "richtig" : "weiter");
        S.aenderung = Date.now();
        return { ok: true, S, ergebnis: m.t };
      case "erwischt":
        if (S.phase !== "spielen" || m.k !== S.k) return nein("Jemand war schneller.");
        if (S.team[pid] === S.teamDran) return nein("Nur das andere Team kann erwischen.");
        karteErledigt(S, "erwischt", pid);
        S.aenderung = Date.now();
        return { ok: true, S, ergebnis: "erwischt" };
      case "korrigieren": {
        // Vertippt? Der Erklärer des letzten Zugs oder der Spielleiter ändert eine Karte (richtig → übersprungen → erwischt)
        const v = S.verlauf[S.verlauf.length - 1];
        if (!v || !["bereit", "ende"].includes(S.phase)) return nein("Gerade nicht.");
        if (!istHost && pid !== v.erklaerer) return nein("Nur " + ((S.spieler[v.erklaerer] || {}).name || "der Erklärer") + " oder der Spielleiter.");
        const k = v.karten[m.i | 0]; if (!k) return nein("Unbekannt.");
        k.e = { richtig: "weiter", weiter: "erwischt", erwischt: "richtig" }[k.e] || "richtig";
        if (k.e !== "erwischt") delete k.von;
        zaehlen(S);
        break;
      }
      case "andererErklaerer":
        if (!istHost || S.phase !== "bereit") return nein("Gerade nicht.");
        S.dran[S.teamDran] += 1; S.erklaerer = erklaererWaehlen(S, S.teamDran); S.weg = 0;
        break;
      case "ueberspringen":
        if (!istHost) return nein("Nur der Spielleiter.");
        if (S.phase === "spielen") zugBeenden(S);
        else if (S.phase === "bereit") { S.verlauf.push({ zug: S.zug, team: S.teamDran, erklaerer: S.erklaerer, art: S.art, karten: [] }); naechsterZug(S); zaehlen(S); }
        else return nein("Gerade nicht.");
        break;
      case "neustart":
        if (!istHost) return nein("Nur der Spielleiter.");
        S.phase = "lobby"; S.erklaerer = null; S.karte = null; S.karten = []; S.rest = null; S.zug = -1; S.verlauf = []; S.punkte = [0, 0];
        break;
      default: return nein("Unbekannt.");
    }
    S.aenderung = Date.now();
    return { ok: true, S };
  }

  // Neuer Spielleiter: Die Karte kannte nur der alte, also den laufenden Zug beenden
  function uebernahme(S0) {
    const S = kopie(S0); S.epoch += 1; S.stapel = S.stapel || []; S.stapelP = S.stapelP || [];
    if (S.phase === "spielen") { S.karte = null; zugBeenden(S); }
    return S;
  }

  // Was ein Mitspieler sehen darf: Die Karte sehen der Erklärer und das andere Team, nicht aber das ratende Team
  function sicht(S, pid) {
    const v = Object.assign({}, S);
    const darf = pid === S.erklaerer || (S.team[pid] !== undefined && S.team[pid] !== S.teamDran);
    v.karte = S.karte != null && darf ? (S.art === "erklaeren" ? KARTEN[S.karte] : { w: vorrat(S.art)[S.karte].w, tabu: [] }) : null;
    v.stapel = undefined; v.stapelP = undefined;
    return v;
  }

  // Bild bereinigen (Punkte 0..1000 × 0..750, Farbe 0..9 oder #RRGGBB, Dicke 1..3)
  function striche(liste) {
    const aus = []; let punkte = 0;
    for (const s of (liste || []).slice(0, 600)) {
      const p = (s.p || []).slice(0, 2 * (MAX_PUNKTE - punkte)).map(v => Math.max(0, Math.min(1000, Math.round(+v || 0))));
      if (p.length < 2) continue;
      punkte += p.length / 2;
      aus.push({ f: typeof s.f === "string" && /^#[0-9a-f]{6}$/i.test(s.f) ? s.f.toUpperCase() : Math.max(0, Math.min(9, s.f | 0)), d: Math.max(1, Math.min(3, s.d | 0 || 1)), p });
      if (punkte >= MAX_PUNKTE) break;
    }
    return aus;
  }

  window.WV = { KARTEN, PANTOMIME, ZEITEN, DURCHGAENGE, ARTEN, ART_NAME, MODI, MODUS_NAME, modus, TEAMS, MAX_PUNKTE, neu, tick, aktion, sicht, uebernahme, striche, mitglieder, zaehlen };
})();
