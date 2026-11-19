// Wortverbot: Spielregeln ohne Netzwerk und ohne Oberfläche (window.WV).
// Zwei Teams. Reihum erklärt einer seinem Team Begriffe, ohne die verbotenen Wörter zu sagen; die Uhr läuft.
// Das andere Team sieht die Karte mit und tippt auf „Erwischt“, wenn ein verbotenes Wort fällt.
// Auf Wunsch wechseln sich Runden mit Erklären, Zeichnen und Pantomime ab.
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
    "Feierabend:Arbeit,Ende,nach,Hause,Schluss|Wochenende:Samstag,Sonntag,frei,Woche,ausschlafen|Montag:Woche,Tag,Anfang,Arbeit,Dienstag"
  ).split("|").map(z => { const [w, rest] = z.split(":"); return { w: w.trim(), tabu: rest.split(",").map(s => s.trim()) }; });

  const ZEITEN = [60, 90, 120];
  const DURCHGAENGE = [1, 2];
  const ARTEN = ["erklaeren", "zeichnen", "pantomime"];
  const ART_NAME = { erklaeren: "Erklären", zeichnen: "Zeichnen", pantomime: "Pantomime" };
  const TEAMS = [{ name: "Füchse", zeichen: "🦊" }, { name: "Eulen", zeichen: "🦉" }];
  const MAX_PUNKTE = 4000;
  const kopie = x => JSON.parse(JSON.stringify(x));

  function neu(code, hostPid, hostName, einst) {
    einst = einst || {};
    return {
      v: 1, spiel: "wortverbot", code, epoch: 0, host: hostPid, phase: "lobby",
      zeit: ZEITEN.includes(+einst.zeit) ? +einst.zeit : 90,
      durchgaenge: DURCHGAENGE.includes(+einst.durchgaenge) ? +einst.durchgaenge : 1,
      gemischt: !!einst.gemischt,
      spieler: { [hostPid]: { name: hostName } }, reihenfolge: [hostPid], team: { [hostPid]: 0 },
      punkte: [0, 0], zug: -1, zuege: 0, dran: [0, 0], erklaerer: null, teamDran: 0, art: "erklaeren",
      rest: null, k: 0, karte: null, karten: [], stapel: [], verlauf: [], weg: 0, aenderung: Date.now()
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
    S.art = S.gemischt ? ARTEN[runde % 3] : "erklaeren";
    S.erklaerer = erklaererWaehlen(S, S.teamDran);
    S.phase = "bereit";
  }
  function karteZiehen(S) {
    let frei = KARTEN.map((_, i) => i).filter(i => !S.stapel.includes(i));
    if (!frei.length) { S.stapel = []; frei = KARTEN.map((_, i) => i); }
    const i = frei[Math.floor(Math.random() * frei.length)];
    S.stapel.push(i); S.karte = i; S.k += 1;
  }
  function zugBeenden(S) {
    S.verlauf.push({ zug: S.zug, team: S.teamDran, erklaerer: S.erklaerer, art: S.art, karten: S.karten });
    S.karten = []; S.karte = null;
    naechsterZug(S);
    zaehlen(S);
  }
  function karteErledigt(S, e, von) {
    const eintrag = { w: KARTEN[S.karte].w, e };
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
        if (typeof m.gemischt === "boolean") S.gemischt = m.gemischt;
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
        S.zuege = 2 * Math.max(Math.max(a, b) * S.durchgaenge, S.gemischt ? 3 : 1);
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
    const S = kopie(S0); S.epoch += 1; S.stapel = S.stapel || [];
    if (S.phase === "spielen") { S.karte = null; zugBeenden(S); }
    return S;
  }

  // Was ein Mitspieler sehen darf: Die Karte sehen der Erklärer und das andere Team, nicht aber das ratende Team
  function sicht(S, pid) {
    const v = Object.assign({}, S);
    const darf = pid === S.erklaerer || (S.team[pid] !== undefined && S.team[pid] !== S.teamDran);
    v.karte = S.karte != null && darf ? (S.art === "erklaeren" ? KARTEN[S.karte] : { w: KARTEN[S.karte].w, tabu: [] }) : null;
    v.stapel = undefined;
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

  window.WV = { KARTEN, ZEITEN, DURCHGAENGE, ARTEN, ART_NAME, TEAMS, MAX_PUNKTE, neu, tick, aktion, sicht, uebernahme, striche, mitglieder, zaehlen };
})();
