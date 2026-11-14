/* ---------------------------------------------------------- exhibit data */
const STOPS = [
  { id: 'hall', wing: 1, title: 'The Dawn of Play', short: 'Welcome', date: 'Wing I', rail: 'Entrance',
    eyebrow: 'Wing I · Librarium Archives', status: null, begin: 'senet',
    body: [
      'Long before anyone wrote rules down, people were already sitting across a board from each other, moving pieces and trusting their luck. This wing gathers the oldest board games we know of, from the Nile valley to the city of Ur.',
      'Four tables are ready to play: Senet, the Royal Game of Ur, Hounds and Jackals, and Hazard at the first dice. Walk up to a plinth, read its story, and take a seat at the table. Where the old rules are lost, the placard says what we play instead, or shows the game as it was found. Beyond the arch, Wing II turns from luck to strategy.'
    ],
    facts: [['Look', 'Drag the view'], ['Walk', 'WASD or arrow keys'], ['Visit', 'Click an exhibit or use the timeline']],
  },
  { id: 'senet', wing: 1, title: 'Senet', date: 'c. 3100 BCE', rail: 'Senet',
    eyebrow: 'Egypt · Early Dynastic period', status: ['recon', 'Rules reconstructed'], game: 'senet',
    body: [
      'Pieces of what may be Senet boards turn up in First Dynasty burials around 3100 BCE, and the first unmistakable painting of the game appears in the tomb of Hesy-Re, about 2620 BCE. It is one of the oldest board games we know by name.',
      'The board has 30 squares, called houses, in three rows of ten. Players threw four flat sticks instead of dice. Over the centuries the game took on religious meaning: its name means "passing", and by the New Kingdom a match stood for the soul\'s journey through the underworld. Tutankhamun was buried with several sets.',
      'No rulebook survives. We play a popular modern reconstruction that follows Timothy Kendall\'s 1979 work.'
    ],
    facts: [['Board', '30 houses, 3 rows of 10'], ['Pieces', '5 each, spools and cones'], ['Moves', '4 throw sticks, 1 to 5'], ['Goal', 'Bear every piece off the board']],
    build: buildSenetBoard },
  { id: 'mehen', wing: 1, title: 'Mehen', date: 'c. 3100–2300 BCE', rail: 'Mehen',
    eyebrow: 'Egypt · Early Dynastic to Old Kingdom', status: ['lost', 'Rules lost'],
    body: [
      'The Mehen board is a snake coiled around itself, with its head at the center and its tail at the rim. It shares its name with a serpent god who wrapped around the sun god Ra to protect him on his night journey.',
      'Up to six players moved small lion figures and marbles along the coils. The game faded after the Old Kingdom, and no text explains how it worked. Scholars have suggested the lions raced toward the snake\'s head, but every version played today is a guess.'
    ],
    facts: [['Board', 'Coiled serpent, segmented'], ['Pieces', 'Lions and marbles'], ['Players', 'Up to six'], ['Rules', 'Unknown']],
    build: buildMehen },
  { id: 'basur', wing: 1, title: 'The Başur Höyük Pieces', short: 'Başur Höyük Pieces', date: 'c. 3000 BCE', rail: 'Başur Höyük',
    eyebrow: 'Southeast Turkey · Early Bronze Age', status: ['lost', 'Game unknown'],
    note: 'On display. No board survives to play on.',
    body: [
      'In 2013, archaeologists excavating a Bronze Age burial mound at Başur Höyük found a set of small carved and painted stones: pyramids, round tokens and little animal figures. At around 5,000 years old, they are often called the oldest gaming pieces yet found.',
      'Nobody knows the game they belonged to. Their different shapes and colors may have marked opposing sides or kept score. They are a reminder that the oldest boards we know are only the ones that happened to survive.'
    ],
    facts: [['Found', '2013, in a burial mound'], ['Pieces', 'Pyramids, tokens, animals'], ['Board', 'None survives']],
    build: buildTokens },
  { id: 'ur', wing: 1, title: 'The Royal Game of Ur', short: 'Royal Game of Ur', date: 'c. 2600–2400 BCE', rail: 'Royal Game of Ur',
    eyebrow: 'Mesopotamia · Sumer', status: ['known', 'Rules survive in writing'], game: 'ur',
    body: [
      'Sir Leonard Woolley found five of these boards while excavating the Royal Cemetery at Ur between 1922 and 1934. The finest are inlaid with shell, red limestone and lapis lazuli. The game, also called Twenty Squares, spread across the ancient Near East, and more than a hundred boards have been found since.',
      'It is the oldest board game whose rules survive in writing. A Babylonian scribe, Itti-Marduk-balāṭu, copied them onto a clay tablet around 177 BCE, and British Museum curator Irving Finkel translated it in the early 1980s. The game outlived its empires: Jewish families in Kochi, India, played a descendant until the 1950s.',
      'We play Finkel\'s widely used reconstruction.'
    ],
    facts: [['Board', '20 squares, 5 rosettes'], ['Pieces', '7 each'], ['Moves', '4 four-sided dice, 0 to 4'], ['Goal', 'Race every piece home']],
    build: buildUrBoard },
  { id: 'dice', wing: 1, title: 'The First Dice', short: 'The First Dice', date: 'c. 2800–1900 BCE', rail: 'The First Dice',
    eyebrow: 'Iran and the Indus Valley', status: ['known', 'Still rolled today'], game: 'hazard',
    note: 'The dice are new, made in the old manner. No rules survive for the Bronze Age games, so this table plays Hazard, the medieval dice game Chaucer knew, as it was written down in the 1700s.',
    body: [
      'Cubic dice are nearly as old as board games. Possibly the oldest yet found come from the Burnt City, Shahr-e Sukhteh in eastern Iran, buried with a set for a race game that has been dated to between 2800 and 2500 BCE.',
      'Graves at Mohenjo-daro in the Indus Valley held terracotta dice from 2500 to 1900 BCE. On one of them the opposite faces add up to seven, as they do on dice today. Players elsewhere threw other things: Senet\'s sticks and Ur\'s four-sided pyramids are on the tables in this wing.',
      'The table here plays Hazard, a two-dice game named in Chaucer\'s Canterbury Tales in the 14th century. Its rules were set down in Hoyle\'s Games by 1790, and a simplified form of it became American craps.'
    ],
    facts: [['Oldest', 'Burnt City, Iran, c. 2800–2500 BCE'], ['Indus', 'Mohenjo-daro, 2500–1900 BCE'], ['Faces', 'Opposites adding to seven, on one Indus die']],
    build: buildDice },
  { id: 'hounds', wing: 1, title: 'Hounds and Jackals', date: 'c. 2000 BCE', rail: 'Hounds and Jackals',
    eyebrow: 'Egypt · Middle Kingdom', status: ['recon', 'Modern reconstruction'], game: 'hounds',
    note: 'The ancient rules are lost. This table plays a modern reconstruction: Howard Carter\'s, of 1912.',
    body: [
      'Howard Carter, later famous for Tutankhamun\'s tomb, found a complete set of this game in a Theban tomb in 1910. It is now at the Metropolitan Museum of Art in New York. Ten slender pins fit its holes: five topped with hound heads and five with jackals.',
      'The board has 58 holes in two tracks, which is why archaeologists also call it 58 Holes. Boards like it turn up from Egypt to Mesopotamia, Anatolia and the Levant. The larger hole near the top looks like the finish, but the rules themselves are lost.',
      'The table plays a modern reconstruction, not the ancient rules. It follows the route Carter himself proposed in 1912, which most scholars still think the likeliest: each side races up its own track to the goal, the lines joining holes 6 and 20, and 8 and 10, send a pin back, and the holes marked "good" give another throw. The stick dice are our choice.'
    ],
    facts: [['Board', '58 holes, palm tree inlay'], ['Pieces', '5 hounds, 5 jackals'], ['Spread', 'Egypt to Anatolia'], ['Rules', 'Lost; modern reconstruction (Carter, 1912)']],
    build: buildHounds },

  { id: 'wing2', wing: 2, title: 'Strategy Takes the Table', short: 'Wing II', date: 'c. 500 BCE – 1000 CE', rail: 'Wing II',
    eyebrow: 'Wing II · Librarium Archives', status: null, begin: 'go',
    body: [
      'The games in the first wing were races, and the dice or sticks had the final word. Here the luck drains away. These are games of position, where you win by surrounding, trapping or outthinking the person across from you.',
      'Nine tables are open: Go on a small board; the Roman games Ludus latrunculorum and Duodecim scripta, both modern reconstructions; Patolli from Mesoamerica, also reconstructed; Nine Men\'s Morris; the mancala game Oware; Alquerque; and two games of the tafl family, the Irish Brandubh and the Norse Hnefatafl. Petteia and Liubo are on display. The Scribe is waiting at each table.'
    ],
    facts: [['Tables', 'Go, Latrunculi, Duodecim scripta, Patolli, Morris, Oware, Alquerque, Brandubh, Hnefatafl'], ['Display', 'Petteia, Liubo']],
  },
  { id: 'petteia', wing: 2, title: 'Petteia', date: 'by 443 BCE', rail: 'Petteia',
    eyebrow: 'Classical Greece', status: ['recon', 'Rules mostly lost'],
    note: 'On display. The 8 × 8 slab is our guess: no petteia board has been securely identified.',
    body: [
      'Petteia, "pebbles", was the board game of classical Greece. The comic poet Cratinus mentions it in 443 or 442 BCE, and Plato and Aristotle both use it to make a point. The board, Julius Pollux wrote much later, was called the polis, the city, and the pieces were called dogs.',
      'Each player had pieces of one colour, and a piece was captured by enclosing it between two enemies, so the art was never to leave a piece alone. Beyond that, the size of the board, the opening position and most of the rules are lost. The Roman game of soldiers, further down this wing, may descend from it.'
    ],
    facts: [['Board', 'The polis, or city'], ['Capture', 'Enclose a piece between two'], ['Rules', 'Mostly lost']],
    build: buildPetteia },
  { id: 'liubo', wing: 2, title: 'Liubo', date: 'by the 4th century BCE', rail: 'Liubo',
    eyebrow: 'China · Warring States to Han', status: ['lost', 'Rules lost'],
    note: 'On display. The board, pieces and sticks are new, after the Mawangdui set.',
    body: [
      'Liubo, "six sticks", was the great board game of Han dynasty China, played by emperors and buried with nobles. The oldest boards come from a 4th-century BCE tomb at Pingshan in Hebei, and a complete set in a lacquer box was found in 1973 in a 2nd-century BCE tomb at Mawangdui.',
      'Each player had six pieces, moved by throws of six sticks, and a piece that reached a certain place was stood on end and became an "owl". The board\'s T, L and V marks also appear on bronze mirrors of the time. After the Han the game faded, perhaps losing out to weiqi, and by the 14th century no one knew how to play it. More than a thousand bamboo slips with its rules were found in the tomb of the Marquis of Haihun in 2019; until they are fully read, every modern version is a reconstruction.'
    ],
    facts: [['Pieces', 'Six a side'], ['Moves', 'Six throwing sticks'], ['Rules', 'Lost; reconstructions only']],
    build: buildLiubo },
  { id: 'go', wing: 2, title: 'Weiqi (Go)', date: 'by the 4th century BCE', rail: 'Weiqi (Go)',
    eyebrow: 'China · Zhou dynasty to Han', status: ['known', 'Still played today'],
    game: 'go',
    body: [
      'Weiqi, known in the West by its Japanese name Go, is the oldest board game still played in much the same form. The Zuo Zhuan, a history compiled around the 4th century BCE, mentions it in a story set in 548 BCE, and both Confucius\'s Analects and the book of Mencius refer to it. Legend credits the sage-emperor Yao with inventing it to teach his son discipline.',
      'The oldest complete board, carved in stone during the Eastern Han dynasty (25–220 CE) and found in Hebei province in 1954, has a 17 × 17 grid like this one. The 19 × 19 board was standard by the Tang dynasty. Go reached Korea and Japan by the 7th century, and it became one of the four arts expected of a cultivated scholar, alongside calligraphy, painting and the zither-like guqin.',
      'At this table you play on the 9 × 9 board used today for quick games and teaching, with modern Chinese scoring. The Scribe plays Go differently from the other games: before each move it plays thousands of quick random games from the position and picks the move that wins most often.'
    ],
    facts: [['Board', '17 × 17 on display; 9 × 9 at the table'], ['Pieces', 'Black and white stones'], ['Goal', 'Surround more territory']],
    build: buildGo },
  { id: 'latrunculi', wing: 2, title: 'Ludus Latrunculorum', date: 'by the 1st century BCE', rail: 'Latrunculi',
    eyebrow: 'Rome · Late Republic to Empire', status: ['recon', 'Modern reconstruction'], game: 'latrunculi',
    note: 'The full Roman rules are lost. This table plays a modern reconstruction: the "Piso" rules of the Locus Ludi project.',
    body: [
      'The "game of soldiers", or of brigands, was Rome\'s war game. The scholar Varro mentions it in the 1st century BCE, Ovid alludes to it, and a 1st-century CE poem, the Laus Pisonis, praises a player commanding an army of glass pieces.',
      'Boards scratched into stone turn up wherever the legions went. Sixteen have been found at the fort of Vindolanda on Hadrian\'s Wall alone, and sizes vary from 7 × 8 to 9 × 10 squares. A piece seems to have been captured by trapping it between two enemies, but how pieces moved is still debated, and every modern version is a reconstruction.',
      'The table plays one such modern reconstruction, not a rulebook from Rome: the "Piso" rules of Locus Ludi, a research project on ancient games at the University of Fribourg. Counters are placed one at a time on the empty board, as the Laus Pisonis suggests, then step one square at a time, and a counter trapped between two enemies is taken.'
    ],
    facts: [['Board', '7 × 8 to 9 × 10 (8 × 8 here)'], ['Pieces', 'Glass counters, 20 a side here'], ['Capture', 'Trap between two'], ['Rules', 'Lost; modern reconstruction (Locus Ludi)']],
    build: buildLatrunculi },
  { id: 'xii', wing: 2, title: 'Ludus Duodecim Scriptorum', short: 'Duodecim Scripta (Twelve Lines)', date: '1st century BCE onward', rail: 'Twelve Lines',
    eyebrow: 'Roman Empire', status: ['recon', 'Modern reconstruction'], game: 'xii',
    note: 'No Roman account of the rules survives. This table plays a modern reconstruction, after the basics worked out by Roland Austin and H. J. R. Murray, in the version the J. Paul Getty Museum gives.',
    body: [
      'The game of twelve lines, ludus duodecim scriptorum, was played on boards of three rows of twelve, each row split in half. Ovid mentions it in his Art of Love, early in the 1st century CE, and boards survive across the Empire from Egypt to Britain, many from army camps.',
      'Many boards spell out six six-letter words instead of plain marks. The one on this table reads LEVATE DALOCV, LVDERE NESCIS, IDIOTA RECEDE: "Get up, make way! You don\'t know how to play: fool, go away!"',
      'Fifteen pieces a side and three dice raced around the board. The game is the ancestor of tabula, and so of backgammon, but how it was played was never written down.'
    ],
    facts: [['Board', 'Three rows of twelve'], ['Pieces', '15 each, three dice'], ['Mentioned', 'Ovid, Art of Love'], ['Descendant', 'Tabula, then backgammon']],
    build: buildXii },
  { id: 'patolli', wing: 2, title: 'Patolli', date: 'by c. 300 CE', rail: 'Patolli',
    eyebrow: 'Mesoamerica', status: ['recon', 'Modern reconstruction'], game: 'patolli',
    note: 'Only parts of the rules were written down. This table plays a modern reconstruction.',
    body: [
      'Patolli was played across Mesoamerica for more than a thousand years: by the Maya from around 300 CE, and later by the Toltecs and the Aztecs. Its track of 52 houses ran in an X across a reed mat, and each player raced six markers by throwing black beans marked on one side.',
      'It was a gambler\'s game. Players staked blankets, precious stones, gold and food, and sometimes their homes or their freedom. The Dominican friar Diego Durán, writing in the 16th century, described players who carried the mat under an arm the way gamblers of his day carried cards. Moctezuma liked to watch his nobles play; the Spanish suppressed the game.',
      'Durán and others recorded the mat, the beans, the markers and the stakes, but not a full set of rules. The table plays a modern reconstruction built on those accounts, the version most often given today: a 1 to enter, captures only in the centre, a treasure paid on the dark houses and another throw on the red tips. The mat, beans and stones are new.'
    ],
    facts: [['Track', '52 houses in an X'], ['Moves', 'Five beans, marked on one side'], ['Markers', 'Six a side'], ['Rules', 'Partly recorded; modern reconstruction']],
    build: buildPatolli },
  { id: 'morris', wing: 2, title: "Nine Men's Morris", date: 'Roman era onward', rail: "Nine Men's Morris",
    eyebrow: 'The Roman world to medieval Europe', status: ['known', 'Rules survive in tradition'], game: 'morris',
    body: [
      'Boards for Nine Men\'s Morris and its smaller cousin, Three Men\'s Morris, are cut into stone across the Roman world. Carvings at the temple of Kurna in Egypt are often dated to about 1400 BCE, but boards scratched into old buildings are notoriously hard to date and may be far younger.',
      'Under names like merels, mill and Mühle, the game became a European favorite. Alfonso X of Castile pictured it in his Book of Games in the 1280s, monks carved boards into the cloister benches of English cathedrals, villagers cut them into the turf of village greens, and Shakespeare mentions a flooded morris board in A Midsummer Night\'s Dream.'
    ],
    facts: [['Board', '24 points on three squares'], ['Pieces', '9 each'], ['Mill', 'Three in a row takes a piece'], ['Win', 'Leave the Scribe two pieces or no moves']],
    build: buildMorrisBoard },
  { id: 'oware', wing: 2, title: 'Mancala (Oware)', date: 'c. 6th–7th century CE', rail: 'Oware',
    eyebrow: 'Africa · Aksum to the Akan', status: ['known', 'Rules survive in tradition'], game: 'oware',
    body: [
      'Mancala is a family of hundreds of games played by sowing seeds around rows of pits. The oldest securely dated evidence comes from the Kingdom of Aksum, in today\'s Ethiopia and Eritrea, where rows of pits were cut into rock and shaped in pottery in the 6th and 7th centuries CE. Hollows in far older stone slabs in Jordan may be boards too, but that is debated.',
      'The name comes from the Arabic naqala, "to move". Traders carried the game across the Islamic world and the Indian Ocean, and enslaved West Africans carried it to the Caribbean and the Americas. Our table plays Oware, the game of the Akan peoples of Ghana and Côte d\'Ivoire, with two rows of six pits and 48 seeds.'
    ],
    facts: [['Board', '2 rows of 6 pits'], ['Pieces', '48 seeds'], ['Capture', 'Make 2 or 3 in a Scribe pit'], ['Win', 'Capture 25 seeds']],
    build: buildOwareBoard },
  { id: 'alquerque', wing: 2, title: 'Alquerque', date: 'by the 10th century CE', rail: 'Alquerque',
    eyebrow: 'The Islamic world and Spain', status: ['recon', 'Rules reconstructed'], game: 'alquerque',
    body: [
      'Alquerque, from the Arabic al-qirkat, is first named late in the 10th century, in Abu al-Faraj al-Isfahani\'s Book of Songs, which does not bother to give the rules: everyone knew them. The game crossed into Spain, and in 1283 Alfonso X of Castile had it described in his Book of Games.',
      'Its board of lines and diagonals, with twelve pieces a side that capture by jumping, made it the parent of draughts, which moved the idea onto a chessboard, and of the Malagasy game fanorona. Alfonso\'s book leaves gaps, so the rules played here are R. C. Bell\'s widely used reconstruction.'
    ],
    facts: [['Board', '5 × 5 points, with diagonals'], ['Pieces', '12 a side'], ['Descendants', 'Draughts, fanorona']],
    build: buildAlquerque },
  { id: 'brandubh', wing: 2, title: 'Brandubh', date: 'c. 900–1000 CE', rail: 'Brandubh',
    eyebrow: 'Ireland · Early Middle Ages', status: ['recon', 'Rules reconstructed'], game: 'brandubh',
    body: [
      'Brandubh, usually translated "black raven", was the Irish member of the tafl family: Norse and Celtic games in which a king tries to escape while a larger army closes in. Irish poems describe it played with five pieces against eight, one of the five being a chief.',
      'The most famous board was found in 1932 at the Ballinderry crannog in County Westmeath, a lake dwelling lived in from the late 9th to the 11th century. It is carved from yew, has 49 peg holes and carved heads for handles, and may have been made in Viking Dublin. No rules survive. Ours follow modern reconstructions built from the poems, the 7 × 7 boards and Linnaeus\'s 1732 notes on the related Sámi game tablut.',
      'Librarium\'s own Calendra comes from the same Celtic world.'
    ],
    facts: [['Board', '7 × 7, a throne and four corners'], ['Pieces', 'King and 4 defenders vs 8'], ['You play', 'The king\'s side'], ['Win', 'Bring the king to a corner']],
    build: buildBrandubhBoard },
  { id: 'hnefatafl', wing: 2, title: 'Hnefatafl', date: 'c. 400 – 1200 CE', rail: 'Hnefatafl',
    eyebrow: 'Scandinavia · the Viking Age', status: ['recon', 'Rules reconstructed'], game: 'hnefatafl',
    body: [
      'Tafl means "table", and for a long time that was all the game needed to be called. When chess and other board games reached the north, it became hnefatafl, the king\'s table, to tell it apart from skáktafl, chess. Its pieces turn up across the Viking world: 24 walrus-ivory men and a whalebone king in a 10th-century grave at Baldursheimur in Iceland, bone pieces at Birka in Sweden, and part of an 11 × 11 board from the early 12th century at Trondheim in Norway.',
      'The sagas mention the game often, but they were written down long after the Viking Age, and nobody recorded its rules before chess pushed it aside. What you play here is a modern reconstruction: the Copenhagen rules, worked out in 2012 by Aage Nielsen, Adam Bartley and Tim Millar from the Fetlar rules of 2007. We leave out two of their finer points, the shieldwall capture and the exit fort, and call a very long game a draw.'
    ],
    facts: [['Board', '11 × 11, a throne and four corners'], ['Pieces', 'King and 12 defenders vs 24'], ['You play', 'The king\'s side'], ['Rules', 'Copenhagen (2012), simplified']],
    build: buildHnefatafl },
  { id: 'wing3', wing: 3, title: 'Kings, Cards and Courts', short: 'Wing III', date: 'c. 480 – 1450 CE', rail: 'Wing III',
    eyebrow: 'Wing III · Librarium Archives', status: null, begin: 'tables',
    body: [
      'Board games became courtly pastimes. In this wing chess travels from India through Persia to the far North, the dice games of Rome and Persia settle into tables, and paper cards arrive from the East and change how Europe plays.',
      'All eleven tables are open: Tables, the family of games that became backgammon; Chaturanga, in a modern reconstruction; Shatranj, the chess of the caliphs\' courts; Xiangqi, the chess of China; Chaturaji, chess for four with dice; Rithmomachia, the scholars\' battle of numbers, also reconstructed; medieval chess on the Lewis chessmen; Courier chess, on twelve files; Four Seasons chess, from Alfonso X\'s Book of Games; Piquet, at the playing cards; and a game of tarocchi, the card game that tarot was made for.'
    ],
    facts: [['Tables', 'Tables, Chaturanga, Shatranj, Xiangqi, Chaturaji, Rithmomachia, medieval chess, Courier chess, Four Seasons chess, Piquet, Tarocchi']],
  },
  { id: 'tables', wing: 3, title: 'Tables', short: 'Tables (Backgammon)', date: 'c. 480 CE onward', rail: 'Tables',
    eyebrow: 'Rome, Persia and medieval Europe', status: ['known', 'Rules survive in modern backgammon'], game: 'tables',
    body: [
      'Tables is the family of games that backgammon belongs to. The Byzantine poet Agathias recorded a disastrous throw by the emperor Zeno, who reigned from 474 to 491, in a game of tabula: 24 points, 15 pieces a side and three dice. It descended from the Roman game of twelve lines. In Persia a close relative, nard, appears between the 3rd and 6th centuries, and one legend credits it to a vizier of Khosrow I.',
      'Medieval Europe played tables everywhere. Louis IX banned it from his court in 1254, Alfonso X\'s Book of Games of 1283 describes several versions, and the name backgammon first appears in English in 1647. The doubling cube is a 1920s addition from New York.',
      'We play modern backgammon, without the cube.'
    ],
    facts: [['Board', '24 points in four quarters'], ['Pieces', '15 each'], ['Moves', 'Two dice, doubles count twice'], ['Goal', 'Bear all fifteen off']],
    build: buildTablesBoard },
  { id: 'chaturanga', wing: 3, title: 'Chaturanga', date: 'by c. 600 CE', rail: 'Chaturanga',
    eyebrow: 'India · Gupta period', status: ['recon', 'Modern reconstruction'], game: 'chaturanga',
    note: 'No rules survive from chaturanga\'s own time. This table plays a modern reconstruction, after H. J. R. Murray: shatranj\'s rules with the Sanskrit pieces, the elephant leaping two squares diagonally.',
    body: [
      'Chaturanga means "four limbs", the four arms of an ancient Indian army: elephants, chariots, cavalry and infantry. It is the oldest known ancestor of chess. The earliest clear references come from north India in the 6th century CE, and the name itself appears in Banabhatta\'s Harsha Charita, written around 625.',
      'It was played on the ashtapada, an uncheckered 8 × 8 board whose marked squares may come from an older race game. The raja, the ratha (chariot) and the ashva (horse) moved like today\'s king, rook and knight, and the mantri stepped one square diagonally. How the gaja, the elephant, moved is still uncertain.'
    ],
    facts: [['Board', '8 × 8 ashtapada'], ['Pieces', 'Raja, mantri, gaja, ashva, ratha, padati'], ['Goal', 'Checkmate, or leave the king bare']],
    build: buildChaturanga },
  { id: 'shatranj', wing: 3, title: 'Shatranj', date: 'c. 600–1200 CE', rail: 'Shatranj',
    eyebrow: 'Persia and the Islamic world', status: ['known', 'Rules survive in writing'], game: 'shatranj',
    body: [
      'Chaturanga reached Sasanian Persia as chatrang, and after the Islamic conquest it became shatranj, the chess of the caliphs\' courts. Masters such as al-Adli and as-Suli wrote about openings and endgames in the 9th and 10th centuries, ranked players into classes, and composed mansubat: chess problems built from chains of checks.',
      'The pieces were slower than ours. The firzan, ancestor of the queen, stepped a single square diagonally, and the alfil, ancestor of the bishop, hopped two. Through Muslim Spain and Sicily the game reached Europe in the 10th century, where, one explanation goes, the elephant\'s tusks were read as a bishop\'s mitre.'
    ],
    facts: [['Board', '8 × 8, unchequered'], ['Firzan', 'One square diagonally'], ['Alfil', 'Jumps two diagonally'], ['Win', 'Checkmate, stalemate or a bare king']],
    build: buildShatranjBoard },
  { id: 'xiangqi', wing: 3, title: 'Xiangqi', short: 'Xiangqi (Chinese Chess)', date: 'c. 800 CE', rail: 'Xiangqi',
    eyebrow: 'China · Tang to Song', status: ['known', 'Still played today'], game: 'xiangqi',
    body: [
      'Xiangqi, the "elephant game" or Chinese chess, is still played by millions. The earliest description of its rules is in a Tang dynasty story collection, the Xuanguai lu of Niu Sengru (779–847), and by the Southern Song dynasty (1127–1279) the game was the same as it is today.',
      'Most historians think it grew, like shatranj, from the Indian chaturanga; some Chinese historians argue that it began in China and spread west. Its pieces are discs that stand on the points, not in the squares. A river divides the board, elephants may not cross it, the general never leaves his palace, and the cannon, which leaps to capture, has no counterpart in chess.'
    ],
    facts: [['Board', '9 × 10 points, split by a river'], ['Pieces', '16 a side'], ['Win', 'Checkmate, or leave the other side no move']],
    build: buildXiangqi },
  { id: 'chaturaji', wing: 3, title: 'Chaturaji', short: 'Chaturaji (Chess for Four)', date: 'described c. 1030 CE', rail: 'Chaturaji',
    eyebrow: 'India · recorded by al-Biruni', status: ['recon', 'Partly reconstructed'], game: 'chaturaji',
    body: [
      'Chaturaji, "four kings", was chess for four players, played with dice. The scholar al-Biruni, who came to India with the armies of Mahmud of Ghazni, described it in his book on India of about 1030: four small armies in the corners of one board, a throw of the dice deciding which kind of piece may move, and stakes paid for every piece taken.',
      'The Bengali scholar Raghunandana described it again around 1500, and a version without dice was still played in parts of India in the 19th century. Hiram Cox in 1801 and Duncan Forbes in 1860 argued that it was older than two-handed chaturanga and the true ancestor of chess. Chess historians since H. J. R. Murray have rejected that idea.',
      'We play al-Biruni\'s game as Murray read it, each army for itself, with ordinary cubic dice. Accounts differ on the dice (Murray thought the first were long four-sided ones), on whether opposite players were partners, and on the rule of the throne, so the table leaves those out.'
    ],
    facts: [['Board', '8 × 8, four armies of eight'], ['Dice', '1 or 5 king or pawn · 2 boat · 3 horse · 4 or 6 elephant'], ['Scores', 'King 5, elephant 4, horse 3, boat 2, pawn 1'], ['Goal', 'Take all three kings']],
    build: buildChaturaji },
  { id: 'rithmo', wing: 3, title: 'Rithmomachia', short: 'Rithmomachia (The Philosophers\' Game)', date: 'c. 1030 CE', rail: 'Rithmomachia',
    eyebrow: 'Southern Germany · monastery schools', status: ['recon', 'Modern reconstruction'], game: 'rithmo',
    note: 'Its rules were never standardised. This table plays a modern reconstruction: Claude de Boissière\'s array and moves of 1556, with the four classic captures.',
    body: [
      'Rithmomachia, "the battle of numbers", was a game for scholars. The first written evidence dates from around 1030, when a monk named Asilo, probably the later Bishop Adalbero of Würzburg, devised it to illustrate the number theory of Boethius\' De institutione arithmetica, the standard arithmetic textbook of the day.',
      'It spread through the schools and monasteries of southern Germany and France. Roger Bacon recommended it to his students, and Thomas More let the citizens of his Utopia play it. Printed books on it appeared in the 16th century, but the rules were never settled, and it faded in the 17th century along with Boethian arithmetic.',
      'Every piece carries a number drawn from Boethius\' ratios. The Evens and the Odds each field rounds, triangles, squares and a pyramid whose value is the sum of a stack of square numbers.'
    ],
    facts: [['Board', '8 × 16'], ['Pieces', '24 a side, each with a number'], ['First record', 'c. 1030, Asilo of Würzburg'], ['Rules', 'Never standardised']],
    build: buildRithmo },
  { id: 'lewis', wing: 3, title: 'The Lewis Chessmen', short: 'Lewis Chessmen', date: 'c. 1150–1200 CE', rail: 'Lewis Chessmen',
    eyebrow: 'Norway and the Hebrides · 12th century', status: ['recon', 'Modern reconstruction'], game: 'lewischess',
    note: 'The figures are our own simplified carvings, not copies. The table plays a modern reconstruction of chess as Europe played it around 1200, after H. J. R. Murray: shatranj\'s moves under European names.',
    body: [
      'Around 1831 a hoard of more than ninety game pieces came to light on the Isle of Lewis in the Outer Hebrides. Most are carved from walrus ivory and a few from whale teeth, probably in Trondheim, Norway, in the later 12th century. The British Museum holds 82 of them and National Museums Scotland 11.',
      'They show chess as medieval Europe played it: kings and queens on thrones, bishops in mitres, knights on ponies, and warders standing in for rooks. Four warders bite the tops of their shields like the berserkers of the Norse sagas. The hoard also held fourteen plain discs for playing tables, and a buckle, perhaps from the bag that carried them.'
    ],
    facts: [['Found', 'Isle of Lewis, about 1831'], ['Material', 'Walrus ivory, whale tooth'], ['Pieces', '79 chessmen, 14 tables discs'], ['Held', 'British Museum, National Museums Scotland']],
    build: buildLewis },
  { id: 'courier', wing: 3, title: 'Courier Chess', short: 'Courier Chess', date: 'by 1202 CE', rail: 'Courier Chess',
    eyebrow: 'Germany · from Wigalois to Ströbeck', status: ['known', 'Rules in print, 1616'], game: 'courier',
    body: [
      'Courier chess is a German chess on a board of twelve files. The poet Wirnt von Gravenberg mentioned it in his romance Wigalois, written around 1202–1205, and expected his readers to know it. Its namesake, the courier, ran any distance diagonally, centuries before the bishop could; after about 1475 that power passed to the bishop of ordinary chess.',
      'Beside the king stand a sage who moves like a king without being one, and a schleich, a fool or jester, who steps one square straight. The old queen and bishop keep their short medieval moves. In the early 1500s Lucas van Leyden painted a woman who seems to be beating a man at courier chess.',
      'In 1616 Gustavus Selenus described the game in detail as one of three forms of chess played in the village of Ströbeck, where it lasted into the 1800s.'
    ],
    facts: [['Board', '12 × 8'], ['New pieces', 'Courier, sage, schleich'], ['First mention', 'Wigalois, c. 1202–1205'], ['Rules', 'Selenus, 1616']],
    build: buildCourier },
  { id: 'fourseasons', wing: 3, title: 'Four Seasons Chess', short: 'Four Seasons Chess', date: '1283 CE', rail: 'Four Seasons',
    eyebrow: 'Castile · Alfonso X\'s Book of Games', status: ['recon', 'Partly reconstructed'], game: 'fourseasons',
    body: [
      'In 1283 King Alfonso X of Castile finished his Libro de los juegos, the Book of Games: an illustrated manuscript of chess problems, dice games and table games. Among them is a chess for four players, the acedrex de los quatro tiempos, the chess of the four seasons.',
      'Each army is a season, a colour, an element and one of the four humours of the body: green for spring, air and blood; red for summer, fire and choler; black for autumn, earth and melancholy; white for winter, water and phlegm. The armies start in the four corners, and play goes round the board as the seasons turn, beginning with spring.',
      'Alfonso\'s text leaves gaps, so the table follows the reading of H. J. R. Murray and Hans Bodlaender: an alfil that leaps two squares, and a mated army that passes to the player who mated it. The book allows dice; we play without, and the diagonals drawn across the centre are only decoration.'
    ],
    facts: [['Board', '8 × 8, an army in each corner'], ['Armies', 'King, rook, knight, alfil, four pawns'], ['Seasons', 'Spring, summer, autumn, winter'], ['Goal', 'Be the last army left']],
    build: buildFourSeasons },
  { id: 'cards', wing: 3, title: 'Playing Cards', date: 'c. 900–1400 CE', rail: 'Playing Cards',
    eyebrow: 'China, Mamluk Egypt and Europe', status: ['lost', 'Earliest games lost'], game: 'piquet',
    note: 'These cards are new designs in the old styles. The first card games are lost, so this table plays Piquet, recorded by 1535 and one of the oldest card games still played.',
    body: [
      'Cards began in China, and a later writer dated them to the Tang dynasty. The earliest certain record is from 969, when an emperor of the Liao dynasty played cards on New Year\'s Eve. They travelled west through Persia to Mamluk Egypt, where packs of four suits showed no human figures: rank was marked with ornament and inscriptions. A Mamluk pack identified in Istanbul\'s Topkapı Palace in the 1930s has suits of coins, cups, swords and sticks.',
      'Cards reached Europe around the 1370s. A Catalan rhyming dictionary names them in 1371, Florence banned a new game called naibbe in 1376, and in 1377 a Dominican friar in Basel described a pack of 52 with kings and marshals. Coins, cups, swords and batons survive today in Italian and Spanish packs.',
      'Piquet, the game at this table, is a two-handed game for a 32-card pack. Rabelais named it in 1535; by the 1650s it was played much as it is now, and Cavendish set its rules down in 1882. Its terms (pique, repique, capot, carte blanche) are French.'
    ],
    facts: [['China', 'Recorded by 969 CE'], ['Egypt', 'Mamluk packs, 15th century'], ['Europe', 'From the 1370s'], ['Suits', 'Coins, cups, swords, batons']],
    build: buildCards },
  { id: 'tarot', wing: 3, title: 'Tarot (Tarocchi)', date: 'c. 1440 CE', rail: 'Tarot',
    eyebrow: 'Northern Italy · 15th century', status: ['known', 'Still played as a card game'], game: 'tarocchi',
    note: 'The trumps on the easel are new paintings in the style of the gilded Milan decks. At the table you can play a simplified game of tarocchi for two: the first rules were never written down.',
    body: [
      'Tarot began as a card game, not a way of telling fortunes. Around 1440 Italian courts added a fifth suit of picture cards, called trionfi or triumphs, that beat the ordinary suits as trumps. A Ferrara account book of 1442 records painted packs of trionfi, and the gilded decks made for the Visconti and Sforza dukes of Milan in the 1440s and 1450s are the oldest that survive.',
      'The game spread to France and Switzerland, where it is still played. Reading the cards came centuries later: Etteilla wrote about divination with tarot around 1770, Antoine Court de Gébelin claimed an ancient Egyptian origin in 1781, and the Rider-Waite deck followed in 1909.'
    ],
    facts: [['Pack', 'Four suits, 21 trumps and the Fool'], ['Played', 'Trick-taking games'], ['Fortune-telling', 'From about 1770']],
    build: buildTarot },
  { id: 'wing4', wing: 4, title: 'Printed Boards and Parlour Tables', short: 'Wing IV', date: 'c. 1300 – 1900 CE', rail: 'Wing IV',
    eyebrow: 'Wing IV · Librarium Archives', status: null, begin: 'foxgeese',
    body: [
      'Printing changed how people played. Rules were set down in books, boards were sold as printed sheets, and court games became family games at the kitchen table. This wing follows chess\'s new queen and the rise of draughts, and games that travelled from India and China into parlours around the world.',
      'Thirteen tables are open: Fox and Geese, where you play the fox; modern chess, at the New Queen; Draughts, and International draughts on its board of a hundred squares; Pachisi; the Game of the Goose; Cribbage; Dominoes; Tablut; Whist, with a Scribe as your partner; Snakes and Ladders; Ludo; and Mahjong, with three Scribes.'
    ],
    facts: [['Tables', 'Fox and Geese, Chess, Draughts, International draughts, Pachisi, the Goose, Cribbage, Dominoes, Tablut, Whist, Snakes and Ladders, Ludo, Mahjong']],
  },
  { id: 'foxgeese', wing: 4, title: 'Fox and Geese', date: 'by c. 1300 CE', rail: 'Fox and Geese',
    eyebrow: 'Northern Europe · Middle Ages', status: ['known', 'Rules survive in tradition'], game: 'foxgeese',
    body: [
      'Fox and Geese is a hunt: one fox against a whole flock. Its likely ancestor is halatafl, the "tail board" game named in the Icelandic Grettis saga, which was written down in the 14th century. It is a cousin of the tafl games in Wing II.',
      'The household accounts of Edward IV of England, who reigned from 1461 to 1483, record silver-gilt pieces for the game: two foxes and 26 hounds, enough for two sets. Boards scratched into cloister benches show that monks played it too, and Queen Victoria is said to have enjoyed it.',
      'Rules varied from place to place. We play a common English form, with one house rule added so that every game ends.'
    ],
    facts: [['Board', '33 points on a cross'], ['Pieces', '1 fox, 13 geese'], ['You play', 'The fox'], ['Win', 'Thin the flock, or slip away']],
    build: buildFoxGeeseBoard },
  { id: 'newqueen', wing: 4, title: 'The New Queen', date: 'c. 1475 CE', rail: 'The New Queen',
    eyebrow: 'Valencia · late 15th century', status: ['known', 'Rules survive in writing'], game: 'chess',
    note: 'Play modern chess here, then shatranj in Wing III to feel how slow the old queen was.',
    body: [
      'For six centuries the piece beside the king was the firzan, a counsellor who stepped a single square diagonally. Then, in late 15th-century Spain, she became the strongest piece on the board, free to sweep any distance in any direction. The bishop gained its long diagonal move at the same time.',
      'The earliest record of the new rules is Scachs d\'amor, a Catalan poem written in Valencia around 1475 by Francí de Castellví, Narcís Vinyoles and Bernat Fenollar, which plays out a game of chess as a courtship. Luis de Lucena\'s book on the game, printed in Salamanca around 1497, spread the new rules further, and the faster game soon replaced the old one across Europe.',
      'On the case: the old firzan, left, and the new queen, right.'
    ],
    facts: [['Queen', 'Any distance, any direction'], ['Bishop', 'Any distance diagonally'], ['First record', 'Scachs d\'amor, c. 1475']],
    build: buildNewChess },
  { id: 'draughts', wing: 4, title: 'Draughts', date: 'c. 1100s – 1500s CE', rail: 'Draughts',
    eyebrow: 'France, Spain and England', status: ['known', 'Rules survive in tradition'], game: 'draughts',
    body: [
      'Draughts was born when someone moved the pieces of alquerque, an Arabic game played on a grid of lines, onto a chessboard. When is disputed: the historian H. J. R. Murray thought the 12th century, while David Parlett finds the first possible reference in England in 1380. Early players called it fierges or ferses, after the medieval chess queen, and later dames.',
      'Around 1535 the French made capturing compulsory, which turned a pleasant pastime into a sharp game of forced sacrifices. The first book on it was printed in Valencia in 1547, and in 1756 the London mathematician William Payne wrote the first in English. In America it is called checkers.'
    ],
    facts: [['Board', '8 × 8, dark squares only'], ['Pieces', '12 each'], ['Capture', 'Compulsory, by jumping'], ['Win', 'Take or block every enemy piece']],
    build: buildDraughtsBoard },
  { id: 'idraughts', wing: 4, title: 'International Draughts', date: 'c. 1550 – 1700 CE', rail: 'International Draughts',
    eyebrow: 'The Netherlands · the ten-square board', status: ['known', 'Rules survive in writing'], game: 'idraughts',
    body: [
      'The bigger board grew up in the Netherlands. The Dutch historian Arie van der Stoep found that a board of ten squares by ten was probably in use there from about 1550, and that the armies grew to twenty a side between 1650 and 1700. Kings that fly the length of a diagonal, and the rule that you must take as many pieces as you can, make it a deeper game than its cousin on the chessboard.',
      'The Dutch call it Pools, "Polish", probably after an old Dutch habit of calling any odd new idea Polish. The first world championship was played in 1894 and won by the Frenchman Isidore Weiss, and the World Draughts Federation, the FMJD, has run the title since 1948. The squares are numbered 1 to 50, so that games can be written down.'
    ],
    facts: [['Board', '10 × 10, squares numbered 1–50'], ['Pieces', '20 each'], ['Kings', 'Fly any distance'], ['Capture', 'Compulsory: take the most you can']],
    build: buildIDraughts },
  { id: 'pachisi', wing: 4, title: 'Pachisi (Chaupar)', date: '16th century CE', rail: 'Pachisi',
    eyebrow: 'India · Mughal court', status: ['known', 'Still played, and the ancestor of Ludo'], game: 'pachisi',
    note: 'Pachisi is played by four in two partnerships, so here you play two colours against the Scribe\'s two. The short game takes about a hundred throws; the full game, more than twice as many.',
    body: [
      'Pachisi and its close relative chaupar are race games played on a cross of cloth with four arms of squares. Instead of dice, players throw cowrie shells and count how many land mouth up; the name comes from the Hindi for twenty-five, the highest throw.',
      'How old it is is hard to pin down. A relief in the Ellora caves, carved between the 6th and 8th centuries, is often read as a game of this kind. The most famous board is a courtyard at Fatehpur Sikri, the city the Mughal emperor Akbar built in the 1570s, laid out in red and white stone; accounts say people stood in as the pieces.',
      'British players took the game home. Simplified, with a single die and a square board, it was sold in England as Ludo from 1896, and in America as Parcheesi.'
    ],
    facts: [['Board', 'A cross of four arms'], ['Throws', 'Cowrie shells'], ['Pieces', '4 each, in four colours'], ['Descendants', 'Ludo, Parcheesi']],
    build: buildPachisi },
  { id: 'goose', wing: 4, title: 'The Game of the Goose', short: 'Game of the Goose', date: 'c. 1575 CE', rail: 'The Goose',
    eyebrow: 'Italy and Europe · 16th century', status: ['known', 'Rules survive in print'], game: 'goose',
    body: [
      'The Game of the Goose is often called the first board game made to be sold. Francesco I de\' Medici, Grand Duke of Tuscany, sent one to Philip II of Spain sometime between 1574 and 1587, and in June 1597 the London printer John Wolfe registered "the newe and most pleasant game of the goose".',
      'It is pure luck: two dice, a spiral of 63 squares, and a goose about every nine squares that sends you flying on. Printed sheets made it cheap, and from a French game of chronology in 1638 onwards, publishers borrowed its spiral to teach history and geography.'
    ],
    facts: [['Board', '63 squares in a spiral'], ['Dice', 'Two'], ['Skill', 'None at all'], ['Win', 'Land exactly on 63']],
    build: buildGooseBoard },
  { id: 'cribbage', wing: 4, title: 'Cribbage', date: '1630s CE', rail: 'Cribbage',
    eyebrow: 'England · the Stuart court', status: ['known', 'Still played'], game: 'cribbage',
    body: [
      'Cribbage is said to have been devised in the 1630s by the poet and courtier Sir John Suckling, who added new rules to an older card game called noddy. John Aubrey, writing later in the century, credited Suckling with it; Suckling was also famous as a gambler.',
      'It is one of very few card games scored on a board. Each player moves two pegs, the back one leapfrogging the front, so a miscount is easy to see. Fifteens, pairs and runs are scored twice over: once as the cards are played, and again when the hands are shown.'
    ],
    facts: [['Inventor', 'Sir John Suckling, 1630s, by tradition'], ['From', 'Noddy, an older card game'], ['Score', 'Pegged on a board, to 121']],
    build: buildCribbage },
  { id: 'dominoes', wing: 4, title: 'Dominoes', date: '18th century CE', rail: 'Dominoes',
    eyebrow: 'China, then Italy and France', status: ['known', 'Still played'], game: 'dominoes',
    body: [
      'A domino is a pair of dice in one tile. A double-six set holds one tile for each throw of two dice, with a blank suit added, 28 in all. The earliest written mention of dominoes comes from Song-dynasty China, in Zhou Mi\'s Former Events in Wulin, written in the 13th century, and Chinese sets are still made without the blanks.',
      'The European game appeared in Italy in the 18th century, perhaps first in Venice and Naples, became a fashion in France, and reached Britain late in the century, possibly with French prisoners of war. The name probably comes from a hooded carnival costume. The oldest European games block the line or draw from the boneyard, like the one at this table.'
    ],
    facts: [['Set', '28 tiles, double-six'], ['First record', 'Song China, 13th century'], ['Europe', 'Italy, 18th century']],
    build: buildDominoes },
  { id: 'tablut', wing: 4, title: 'Tablut', date: '1732 CE', rail: 'Tablut',
    eyebrow: 'Lapland · recorded by Linnaeus', status: ['recon', 'Rules partly read'], game: 'tablut',
    body: [
      'In the summer of 1732 the young Swedish naturalist Carl Linnaeus travelled through Lapland and wrote down a board game the Sámi played, Tablut, with a sketch of the board: a 9 × 9 mat of embroidered reindeer hide. A king and eight Swedes stand in the middle; sixteen Muscovites wait at the edges.',
      'It is the last of the tafl games, the "table" games of northern Europe before chess, to be recorded while still in use. Linnaeus wrote in Latin and Swedish, and an English translation of 1811 garbled several rules, so players still argue over details. This table follows the reading most use today: the king escapes to any edge, and helps to capture.'
    ],
    facts: [['Recorded', 'Carl Linnaeus, Lapland, 1732'], ['Board', '9 × 9, of reindeer hide'], ['Sides', 'King and 8 Swedes against 16 Muscovites']],
    build: buildTablut },
  { id: 'whist', wing: 4, title: 'Whist', date: '1742 CE', rail: 'Whist',
    eyebrow: 'England · Hoyle\'s treatise', status: ['known', 'Rules in print since 1742'], game: 'whist',
    body: [
      'Whist grew out of ruff and honours, one of the English trick-taking games descended from triumph, and the name itself dates from the 1600s. Daines Barrington wrote that gentlemen first played it seriously at the Crown Coffee House in Bedford Row, London, around 1728.',
      'In 1742 Edmond Hoyle published A Short Treatise on the Game of Whist. It set the standard rules for the next hundred years and made his name a byword: "according to Hoyle" still means "by the rules". Long whist was played to 10 points; short whist, to 5, later replaced it in Britain.',
      'Whist is a partnership game, and its descendants include bridge. You play with the Scribe as your partner, North, against two more Scribes.'
    ],
    facts: [['Players', 'Four, in two partnerships'], ['Deck', '52 cards, thirteen each'], ['Trumps', 'The dealer\'s last card, turned up'], ['Game', '5 points, short whist']],
    build: buildWhist },
  { id: 'snakes', wing: 4, title: 'Snakes and Ladders', date: '18th–19th century CE', rail: 'Snakes and Ladders',
    eyebrow: 'India, then England', status: ['known', 'Still played today'], game: 'snakes',
    body: [
      'Long before it was a children\'s game, snakes and ladders was a lesson. In India it was gyan chaupar, the game of knowledge, or moksha patam, played by Jains, Hindus and Sufis on boards of their own. Ladders were virtues such as faith, generosity and knowledge; snakes were vices such as theft, debt and lust; and square 100 was liberation. Boards survive from 18th- and 19th-century western India.',
      'The snakes outnumbered the ladders, because the way down is easier than the way up. F. H. Ayres registered an English version in 1892, with Victorian virtues and as many ladders as snakes, and in 1943 Milton Bradley turned the snakes into playground chutes.'
    ],
    facts: [['Squares', '100'], ['Moves', 'One die'], ['Goal', 'Square 100: liberation']],
    build: buildSnakesBoard },
  { id: 'ludo', wing: 4, title: 'Ludo', date: '1896 CE', rail: 'Ludo',
    eyebrow: 'England, from India', status: ['known', 'Still played'], game: 'ludo',
    body: [
      'Ludo is Pachisi made simple for the Victorian nursery. The royal game of India, played with cowrie shells on a cloth cross, reached Britain through trade and empire, and in 1896 a version with a single die and a square board was patented in England as Ludo, Latin for "I play".',
      'It travelled the world from there. The Royal Navy turned it into a rougher game called uckers, and it is still one of the first board games many children learn. The race, the six to come out and the token sent home all come straight from Pachisi, two tables away.'
    ],
    facts: [['Patented', 'England, 1896'], ['From', 'Pachisi'], ['Name', 'Latin ludo, "I play"']],
    build: buildLudo },
  { id: 'mahjong', wing: 4, title: 'Mahjong', date: 'mid-1800s CE', rail: 'Mahjong',
    eyebrow: 'China · Qing dynasty', status: ['known', 'Still played today'], game: 'mahjong',
    note: 'A table needs four, so three Scribes join you. Scoring is left out: whoever goes out first wins the hand.',
    body: [
      'Mahjong took shape in the Shanghai region in the middle or later years of the 19th century, during the Qing dynasty. It grew out of older Chinese card games and keeps their money suits: circles, bamboo and characters, joined by winds and dragons. A full set has 136 tiles, or 144 with the flowers and seasons.',
      'After the First World War an American living in Shanghai, Joseph P. Babcock, simplified the rules, added English labels and coined the name mah-jongg. In the mid-1920s it became a craze in the United States, Britain and Australia, and in 1937 players in New York founded the National Mah Jongg League.'
    ],
    facts: [['Tiles', '136, or 144 with flowers'], ['Suits', 'Circles, bamboo, characters'], ['Players', 'Four: you and three Scribes']],
    build: buildMahjong },
  { id: 'wing5', wing: 5, title: 'The Modern Board Game', short: 'Wing V', date: 'c. 1840 CE – today', rail: 'Wing V',
    eyebrow: 'Wing V · Librarium Archives', status: null, begin: 'mansion',
    body: [
      'With cheap colour printing, board games became products. Publishers in Salem, Springfield, London and Ravensburg sold games about virtue, money and getting ahead, and inventors patented their ideas. This wing runs from the first American board games to the ancestors of games still on the shelf, and ends with Librarium\'s own.',
      'All nine tables are open: the Mansion of Happiness, the Checkered Game of Life, Reversi, Halma, Dots and Boxes, Chinese checkers, the Landlord\'s Game, Kalah and Hex.'
    ],
    facts: [['Tables', 'Mansion of Happiness, Checkered Game of Life, Reversi, Halma, Dots and Boxes, Chinese checkers, the Landlord\'s Game, Kalah, Hex']],
  },
  { id: 'mansion', wing: 5, title: 'The Mansion of Happiness', date: '1843 CE', rail: 'Mansion of Happiness',
    eyebrow: 'Salem, Massachusetts', status: ['known', 'Rules survive in print'], game: 'mansion',
    note: 'Note the teetotum: dice were thought too close to gambling.',
    body: [
      'In 1843 W. & S. B. Ives of Salem, Massachusetts, published The Mansion of Happiness, "an instructive, moral and entertaining amusement". The Library of Congress calls it possibly the first board game published in the United States. It was close to a copy of an English game of 1800, and who adapted it is uncertain: Anne Abbott, who designed other games for the same publisher, has often been credited.',
      'Players spun a numbered top called a teetotum and moved along a spiral. Virtues such as temperance and generosity carried them toward the mansion at the centre; vices such as idleness sent them back toward the pillory.',
      'The table follows the original: all 67 squares in their places on the 1843 board, and the rules printed with the game. A Cheat spends a month in the House of Correction and a Robber two in Prison, a Drunkard goes to the Stocks and a Sabbath Breaker to the Whipping Post, and the Mansion must be reached by an exact spin. The board here is newly drawn, and the squares carry their names instead of the original engravings.'
    ],
    facts: [['Publisher', 'W. & S. B. Ives, Salem'], ['Board', '67 squares on a spiral'], ['Moves', 'A spinning teetotum'], ['Goal', 'Reach the mansion at the centre']],
    build: buildMansion },
  { id: 'lifegame', wing: 5, title: 'The Checkered Game of Life', short: 'Checkered Game of Life', date: '1860 CE', rail: 'Game of Life',
    eyebrow: 'Springfield, Massachusetts', status: ['known', 'Rules survive in print'], game: 'lifegame',
    note: 'The table follows Bradley\'s rules; what each spin allows comes from a modern reproduction.',
    body: [
      'Milton Bradley had just set up a colour lithography shop in Springfield, Massachusetts, when he printed The Checkered Game of Life in the winter of 1860. He sold the first few hundred copies himself on a two-day trip to New York, and by 1861 buyers had taken more than 45,000.',
      'Like the Mansion of Happiness it was a moral journey, played with a teetotum. Its squares held the virtues and dangers of a life, from Influence and Fat Office to Poverty, Prison and Ruin. The company Bradley founded later grew it into The Game of Life.',
      'Unlike the Mansion, it let players choose their road: each spin offered moves up, down, across or diagonally, and the first to 100 points won. The board here is laid out as on the company\'s edition of about 1911, newly drawn, with names and numbers in place of the engravings. Bradley\'s patent of 1866 gives the rules; what each number of the teetotum allows follows a modern reproduction. Its darkest square, a stark mark of the moralising of its day, puts a player out of the game.'
    ],
    facts: [['Maker', 'Milton Bradley'], ['Board', '8 × 8, 32 squares in play'], ['Moves', 'A teetotum: up, across or diagonally'], ['Goal', 'First to 100 points'], ['Sold', 'Over 45,000 by 1861']],
    build: buildCheckeredLife },
  { id: 'reversi', wing: 5, title: 'Reversi', date: '1883 CE', rail: 'Reversi',
    eyebrow: 'Victorian England', status: ['known', 'Rules survive in print'], game: 'reversi',
    body: [
      'Two Englishmen, Lewis Waterman and John W. Mollett, each claimed to have invented reversi in 1883, and each called the other a fraud. Whoever was first, the game of flipping discs caught on: the Saturday Review mentioned it in 1886, and the German publisher Ravensburger was making it by 1893.',
      'In 1971 the Japanese salesman Goro Hasegawa patented Othello, which starts from four discs in the centre instead of an empty board. Othello is the version played in tournaments today, and its opening is the one we use here.'
    ],
    facts: [['Board', '8 × 8'], ['Pieces', '64 two-sided discs'], ['Win', 'Most discs showing']],
    build: buildReversiBoard },
  { id: 'halma', wing: 5, title: 'Halma', date: '1883–84 CE', rail: 'Halma',
    eyebrow: 'Massachusetts and Germany', status: ['known', 'Still played, as Chinese checkers'], game: 'halma',
    body: [
      'Halma, from the Greek for "leap", was invented in 1883 or 1884 by George Howard Monks, a surgeon at Harvard Medical School, who drew on an English game called Hoppity. Each player starts with a camp of men in one corner of a 16 × 16 board and races to move them all into the opposite corner, stepping, or leaping over any piece in chains of jumps.',
      'In 1892 a version on a six-pointed star was published as Stern-Halma, "star Halma". Sold in America under a more exotic name, it became Chinese checkers: a game with no link to China, and none to checkers.',
      'At this table you play the two-player game, 19 men a side. Long chains of leaps are the whole art: build ladders of your own men, and borrow the Scribe\'s.'
    ],
    facts: [['Board', '16 × 16'], ['Players', 'Two or four'], ['Moves', 'A step, or chains of leaps'], ['Descendant', 'Chinese checkers']],
    build: buildHalma },
  { id: 'dotsboxes', wing: 5, title: 'Dots and Boxes', date: 'late 19th century CE', rail: 'Dots and Boxes',
    eyebrow: 'France', status: ['known', 'Rules survive in print'], game: 'dotsboxes',
    body: [
      'Dots and Boxes needs only a pencil and paper. The French mathematician Édouard Lucas, best known for the Tower of Hanoi puzzle, published it in the late 19th century as la pipopipette, and it has gone by many names since, from boxes to pigs in a pen.',
      'It looks simple, but it hides deep strategy. Strong players count the chains of boxes forming on the board and give a few boxes away on purpose, to force their opponent to open the long chains. The mathematician Elwyn Berlekamp wrote a whole book about it in 2000.'
    ],
    facts: [['Grid', '4 × 4 boxes'], ['Score', 'Close a box, draw again'], ['Win', 'Most boxes']],
    build: buildDotsBoard },
  { id: 'chinese', wing: 5, title: 'Chinese Checkers', short: 'Chinese Checkers', date: '1892 CE', rail: 'Chinese Checkers',
    eyebrow: 'Germany and the United States', status: ['known', 'Rules survive in print'], game: 'chinese',
    body: [
      'Chinese checkers is neither Chinese nor checkers. It began as Stern-Halma, "star Halma", which the German publisher Ravensburger brought out in 1892: Halma\'s race moved onto a six-pointed star, so that two, three, four or six players could each race their marbles into the opposite point.',
      'In 1928 the American firm J. Pressman & Co. sold the game as Hop Ching Checkers, and the brothers Bill and Jack Pressman soon renamed it Chinese checkers, to suit the fashion of the time for anything from the East. The name stuck, though the game has no Chinese origin.'
    ],
    facts: [['First published', 'Ravensburger, 1892, as Stern-Halma'], ['Renamed', 'J. Pressman & Co., USA, 1928'], ['Board', 'A star of 121 holes']],
    build: buildChinese },
  { id: 'landlord', wing: 5, title: 'The Landlord\'s Game', date: '1904 CE', rail: 'Landlord\'s Game',
    eyebrow: 'United States', status: ['known', 'Rules survive in the patent'], game: 'landlord',
    note: 'The board follows the drawing in Magie\'s patent, space for space. At the table you play the patent\'s rules against the Scribe, three times round by default or five as the patent has it.',
    body: [
      'Lizzie Magie was granted U.S. Patent 748,626 for The Landlord\'s Game on January 5, 1904. She meant it as a lesson. A follower of the economist Henry George, she wanted players to feel how land monopoly enriches landlords and ruins everyone else, and she gave the game two sets of rules: one that rewarded monopoly, and one that rewarded shared prosperity.',
      'For years players made their own boards, adding the streets of their own towns; Quakers in Atlantic City gave it theirs. In 1935 Parker Brothers bought a version from Charles Darrow, published it as Monopoly and credited him as its inventor. Magie\'s part came back to light in the 1970s, when Ralph Anspach dug up her patents while fighting Parker Brothers in court over his game Anti-Monopoly.'
    ],
    facts: [['Patent', 'U.S. 748,626, 1904'], ['Inventor', 'Lizzie Magie'], ['Descendant', 'Monopoly (1935)']],
    build: buildLandlord },
  { id: 'kalah', wing: 5, title: 'Kalah', date: '1940 CE', rail: 'Kalah',
    eyebrow: 'United States', status: ['known', 'Rules survive in print'], game: 'kalah',
    body: [
      'Kalah is mancala made for the modern West. William Julius Champion Jr., a Yale graduate, devised it in 1940 from the African and Asian sowing games he had read about, began selling it in 1944, and patented it in the 1950s. His Kalah Game Company, founded in 1958 in Holbrook, Massachusetts, made sets into the 1970s.',
      'Champion sold it as an educational game, and towns and schools held Kalah tournaments in the early 1960s. It became a favourite of computer scientists too: programs could play some sizes perfectly by 2001, and later analysis shows that with perfect play the first player usually wins.'
    ],
    facts: [['Inventor', 'William Julius Champion Jr., 1940'], ['Made in', 'Holbrook, Massachusetts'], ['Family', 'Mancala']],
    build: buildKalah },
  { id: 'hex', wing: 5, title: 'Hex', date: '1942 CE', rail: 'Hex',
    eyebrow: 'Copenhagen and Princeton', status: ['known', 'Rules survive in print'], game: 'hex',
    body: [
      'The Danish poet and mathematician Piet Hein invented Hex at the Niels Bohr Institute in Copenhagen and published it in the newspaper Politiken on 26 December 1942, under the name Polygon. In 1948 or 1949 John Nash came up with the same game at Princeton, where his fellow students called it Nash, or John. Parker Brothers sold it as Hex in 1952, and Martin Gardner wrote it up in Scientific American in 1957.',
      'Hex has two remarkable properties. It can never be drawn, because a full board always holds exactly one winning chain. And Nash proved that the first player can always win with perfect play, without showing how: the argument is called strategy stealing. That is why players today often use the swap rule. Here you always move first, and you can turn the swap rule on for an even game.'
    ],
    facts: [['Invented', 'Piet Hein, 1942; John Nash, 1948–49'], ['Board', 'A rhombus of hexagons, 11 × 11 by tradition'], ['Draws', 'Impossible']],
    build: buildHex },
  { id: 'wing6', wing: 6, title: 'Games of the World', short: 'Wing VI', date: 'Across the oceans', rail: 'Wing VI',
    eyebrow: 'Wing VI · Librarium Archives', status: null, begin: 'mutorere',
    body: [
      'The other wings follow one long road, from Egypt and Mesopotamia through Europe to the shop shelf. But play has many homelands. This wing gathers games from the Pacific, Africa and Asia: some ancient, some first written down by visitors, all still played today.',
      'All sixteen tables are open: Mū tōrere from Aotearoa New Zealand, Shogi, Gomoku and Hanafuda from Japan, Jungle from China, Nard from Iran and the Caucasus, Makruk from Thailand, Bagh-chal from Nepal, Kōnane from Hawaiʻi, Yut Nori and Janggi from Korea, Fanorona from Madagascar, Bao from the Swahili coast, Morabaraba from southern Africa, and Seega and Tâb from Egypt.'
    ],
    facts: [['Tables', 'Mū tōrere, Shogi, Gomoku, Hanafuda, Jungle, Nard, Makruk, Bagh-chal, Kōnane, Yut Nori, Janggi, Fanorona, Bao, Morabaraba, Seega, Tâb']],
  },
  { id: 'mutorere', wing: 6, title: 'Mū tōrere', date: 'first described in 1917', rail: 'Mū tōrere',
    eyebrow: 'Aotearoa New Zealand · Māori', status: ['known', 'Still played'], game: 'mutorere',
    body: [
      'Mū tōrere is a Māori game for two, played on a star of eight arms, the kewai, round a centre, the pūtahi, drawn on the ground or carved in wood. The board has been likened to an octopus. Each player has four men, and the aim is to leave the other player no move at all.',
      'It was first described in print by Elsdon Best in 1917. Scholars still debate whether it is wholly Māori or partly an answer to the draughts that settlers brought, and accounts of its rules differ. It looks simple, but settlers who thought so are said to have lost to it again and again. Played perfectly, it is a draw.'
    ],
    facts: [['Board', 'Eight arms and a centre'], ['Men', 'Four each'], ['Win', 'Leave the other side no move']],
    build: buildMuTorere },
  { id: 'shogi', wing: 6, title: 'Shogi', short: 'Shogi (Japanese Chess)', date: 'oldest pieces c. 1058 CE', rail: 'Shogi',
    eyebrow: 'Japan', status: ['known', 'Still played'], game: 'shogi',
    body: [
      'Shogi, Japanese chess, belongs to the same family as chaturanga and xiangqi. The oldest pieces yet found, sixteen of them, were dug up at Kōfuku-ji in Nara beside a wooden plaque dated 1058, and they already have the five-sided shape of modern pieces.',
      'Both sides\' pieces are the same colour: only the way a piece points shows whose it is. That made possible shogi\'s great invention of the 16th century, the drop. A captured piece changes sides, and its captor can put it back on the board later, so the game never thins out. Ōhashi Sōko set down the standard rules in 1636.'
    ],
    facts: [['Board', '9 × 9'], ['Pieces', 'One colour, pointing at the enemy'], ['Drops', 'Captured pieces come back into play']],
    build: buildShogi },
  { id: 'gomoku', wing: 6, title: 'Gomoku', date: 'named renju in 1899', rail: 'Gomoku',
    eyebrow: 'Japan', status: ['known', 'Still played'], game: 'gomoku',
    body: [
      'Gomoku narabe, "five pieces in a row", is played with the stones and board of Go: whoever first sets five stones in an unbroken line wins. Games of getting five in a row are played across East Asia, as wuziqi in China, omok in Korea and caro in Vietnam.',
      'On 6 December 1899 the Japanese journalist Kuroiwa Ruikō gave the serious game the name renju, "connected pearls", in his newspaper Yorozu Chōhō. Renju later put restrictions on black, the first player, and with good reason: in 1994 Victor Allis showed by computer that in freestyle gomoku on a 15 × 15 board, black can always win.'
    ],
    facts: [['Board', '15 × 15, or a Go board'], ['Renju', 'Named by Kuroiwa Ruikō, 1899'], ['Solved', 'A first-player win (Allis, 1994)']],
    build: buildGomoku },
  { id: 'koikoi', wing: 6, title: 'Hanafuda', short: 'Hanafuda (Koi-koi)', date: 'Edo period onward', rail: 'Hanafuda',
    eyebrow: 'Japan', status: ['known', 'Still played'], game: 'koikoi',
    body: [
      'Hanafuda, "flower cards", emerged in Edo-period Japan after repeated bans on Western-style playing cards. There are no numbers and no suits as Europe knew them: forty-eight small cards in twelve suits, one for each month, each shown by its plant, from the pine of January to the paulownia of December. By the 19th century the twelve-month pack was standard.',
      'Each month has four cards, some worth more than others: brights such as the crane and the moon, animals such as the boar and the deer, poem ribbons, and plain cards. In 1889 a small company in Kyoto was founded to make hanafuda packs. It was called Nintendo.',
      'Koi-koi, the game at this table, is a two-player matching game: collect combinations, then decide whether to stop or to call "koi-koi" and push your luck. These cards are drawn in our own simple style, not copied from a printed pack.'
    ],
    facts: [['Cards', '48, four for each month'], ['Kinds', 'Brights, animals, ribbons, plain'], ['Maker', 'Nintendo, founded 1889 for hanafuda'], ['Game here', 'Koi-koi, for two']],
    build: buildKoikoi },
  { id: 'makruk', wing: 6, title: 'Makruk', date: 'traditional', rail: 'Makruk',
    eyebrow: 'Thailand', status: ['known', 'Still played'], game: 'makruk',
    body: [
      'Makruk, Thai chess, is a cousin of chess from the same Indian ancestor, chaturanga. Its pieces keep moves that European chess gave up: the met, the counsellor beside the king, steps only one square diagonally, like the Persian firzan, and the khon moves like a shogi silver general. Cambodia plays nearly the same game as ouk chaktrang.',
      'The pawns are cowrie shells, set out on the third rank, and a pawn that reaches the sixth rank is turned over to show its promotion. Endgames are timed by counting: the side behind counts its moves, and if the count runs out before mate, the game is drawn. It is still played across Thailand today.'
    ],
    facts: [['Ancestor', 'Chaturanga'], ['Pawns', 'Cowrie shells, promoted on the sixth rank'], ['Cousin', 'Ouk chaktrang, Cambodia']],
    build: buildMakruk },
  { id: 'baghchal', wing: 6, title: 'Bagh-chal', short: 'Bagh-chal (Tigers and Goats)', date: 'traditional', rail: 'Bagh-chal',
    eyebrow: 'Nepal', status: ['known', 'Still played'], game: 'baghchal',
    body: [
      'Bagh-chal, "the tigers\' move", is the hunt game of Nepal. Four tigers face twenty goats on a board of lines like alquerque\'s: the tigers try to eat five goats, and the goats try to hem every tiger in so that none can move.',
      'Hunt games that pit a few strong pieces against many weak ones are played all over South Asia, from the lambs and tigers of southern India to the tiger games of Bengal. In Nepal, Bagh-chal is played on boards scratched on the ground as well as on cast brass sets with tiger and goat pieces.',
      'You may lead either side. The goats are the harder, more patient role. Once all twenty are down, no position may repeat, so the goats cannot simply wait.'
    ],
    facts: [['Board', '5 × 5 points with diagonals'], ['Sides', '4 tigers, 20 goats'], ['Tigers win', 'By taking five goats'], ['Goats win', 'By leaving no tiger a move']],
    build: buildBaghchal },
  { id: 'jungle', wing: 6, title: 'Jungle', short: 'Jungle (Dou Shou Qi)', date: '20th century', rail: 'Jungle',
    eyebrow: 'China', status: ['known', 'Still played'], game: 'jungle',
    body: [
      'Dou shou qi, "the game of fighting animals", is a Chinese board game known in English as Jungle. Its history is obscure: it is a modern game, played in China in the 20th century, and it reached Britain in printed sets such as Waddington\'s Jungle King in the 1950s.',
      'Each side has eight animals, ranked from the elephant down to the rat, and a stronger animal eats a weaker one. The rat is the exception: it alone can kill the elephant, by creeping into its ear, so the story goes. The rat can also swim, while the lion and the tiger leap the rivers in one bound.',
      'The aim is not to take every animal but to walk one into the enemy\'s den, past the three traps that guard it, where even an elephant is helpless.'
    ],
    facts: [['Board', '7 × 9, with two rivers'], ['Animals', 'Eight each, elephant down to rat'], ['Win', 'Enter the enemy den']],
    build: buildJungle },
  { id: 'konane', wing: 6, title: 'Kōnane', date: 'by 1778–79', rail: 'Kōnane',
    eyebrow: 'Hawaiʻi', status: ['known', 'Still played'], game: 'konane',
    body: [
      'Kōnane is a Hawaiian game of capture. Old boards, papamū, were cut into large flat stones as rows of small hollows, and the pieces were black lava and white coral; one such stone survives at Puʻuhonua o Hōnaunau. Captain James Cook\'s expedition saw the game played during its visit in 1778–79.',
      'The board starts full. Two stones are lifted to open it, and from then on every move is a jump that takes a stone, so the board empties as the game goes on. The first player who cannot jump loses, and a draw is impossible. Mathematicians have shown that judging a large board is extremely hard.'
    ],
    facts: [['Board', '8 × 8 here; old boards came in many sizes'], ['Stones', 'Black lava and white coral'], ['Win', 'Be the last able to capture']],
    build: buildKonane },
  { id: 'yut', wing: 6, title: 'Yut Nori', date: 'traditional', rail: 'Yut Nori',
    eyebrow: 'Korea', status: ['known', 'Still played'], game: 'yut',
    body: [
      'Yut nori is the Korean family game of the New Year, played at Seollal and at the first full moon. Instead of dice, players throw four sticks, flat on one side and round on the other, and count the flat sides that land up: do (a pig, one step), gae (a dog, two), geol (a sheep, three), yut (a cow, four) and mo (a horse, five).',
      'Each side races four pieces round a board of 29 stations, taking shortcuts across the middle from the corners. Pieces of one side can travel stacked, landing on an enemy sends it home, and a yut or a mo earns another throw. Its origin is uncertain; it is often traced to the Three Kingdoms period.'
    ],
    facts: [['Sticks', 'Four, flat on one side'], ['Board', '29 stations'], ['Pieces', 'Four each, which can travel stacked']],
    build: buildYut },
  { id: 'janggi', wing: 6, title: 'Janggi', date: 'traditional', rail: 'Janggi',
    eyebrow: 'Korea', status: ['known', 'Still played'], game: 'janggi',
    body: [
      'Janggi, Korean chess, grew from Chinese xiangqi and keeps its board of nine files and ten rows, its palaces and most of its pieces, but drops the river, so elephants and soldiers range freely. Its cannon must jump to move at all, and its eight-sided pieces come in three sizes, the generals largest.',
      'The sides are named Cho and Han, after the rival states of the Chu–Han contention that followed the fall of the Qin dynasty in China. Older men still play it in Korean city parks, and the first world tournament was held in 2009. A game can be won on points: when neither side can force mate, the material left on the board decides.'
    ],
    facts: [['Board', '9 × 10 points, no river'], ['Sides', 'Cho (blue) and Han (red)'], ['Unusual', 'Passing is allowed']],
    build: buildJanggi },
  { id: 'fanorona', wing: 6, title: 'Fanorona', date: 'traditional', rail: 'Fanorona',
    eyebrow: 'Madagascar', status: ['known', 'Still played'], game: 'fanorona',
    body: [
      'Fanorona is a game of Madagascar, widely played there, and the full game, fanoron-tsivy, is played on five rows of nine points joined by lines and diagonals. It looks like alquerque, but its captures are its own: a stone takes by moving up to an enemy line or by moving away from one, and the whole unbroken line falls at once.',
      'A Malagasy legend tells how King Ralambo chose his heir by summoning his sons while pretending to be ill. The elder was so absorbed in a fanorona problem that the younger, Andrianjaka, arrived first and became king. In 2007 computer scientists showed that, played perfectly, the game is a draw.'
    ],
    facts: [['Board', '5 × 9 points'], ['Stones', '22 each'], ['Capture', 'By approach or withdrawal']],
    build: buildFanorona },
  { id: 'bao', wing: 6, title: 'Bao', date: 'in verse by the 1820s', rail: 'Bao',
    eyebrow: 'East Africa · the Swahili coast', status: ['known', 'Still played'], game: 'bao',
    body: [
      'Bao, Swahili for "board", is the mancala of East Africa, most popular among the Swahili of Tanzania and Kenya, and one of the most complex of all mancala games. The board has four rows of eight pits, two for each player, and a larger square pit, the nyumba or house, with powers of its own.',
      'The poet Muyaka bin Haji of Mombasa praised the game in verse in the 1820s. In Bao la Kiswahili, the masters\' version, players start with most of their 32 seeds in hand and sow them in one by one. Zanzibar\'s bao masters are held in high respect, and tournaments are held in Tanzania, Zanzibar, Kenya and Malawi.',
      'This table plays Bao la Kujifunza, the learners\' game: every seed starts on the board, two to a pit, and the house is an ordinary pit. Captures still fly from one end of the row to the other.'
    ],
    facts: [['Board', 'Four rows of eight pits'], ['Seeds', '64'], ['Win', 'Empty the other inner row']],
    build: buildBao },
  { id: 'morabaraba', wing: 6, title: 'Morabaraba', date: 'traditional', rail: 'Morabaraba',
    eyebrow: 'South Africa, Botswana and Lesotho', status: ['known', 'Still played'], game: 'morabaraba',
    body: [
      'Morabaraba is the mill game of southern Africa, known as mlabalaba, umlabalaba and mmela among other names. Its own name comes from the Southern Sotho moraba-raba, "to mill" or "to go round in a circle". The pieces are called cows, and it is a favourite of young herders, who scratch the board into the ground.',
      'Some have said British settlers brought it, but rock engravings said to be about 800 years old point to an older African history. Today it is a recognised sport: Mind Sports South Africa runs leagues, and world championships have been held since 1997.'
    ],
    facts: [['Pieces', '12 cows each'], ['Board', '24 points, with diagonals'], ['Championships', 'Since 1997']],
    build: buildMorabaraba },
  { id: 'seega', wing: 6, title: 'Seega', date: 'recorded in the 1820s', rail: 'Seega',
    eyebrow: 'Egypt · recorded by Edward Lane', status: ['known', 'Rules survive in writing'], game: 'seega',
    body: [
      'Seega is a game of the Nile valley, played on rows of cups scooped in the ground or cut in stone. Edward William Lane, an English scholar who lived in Cairo in the 1820s and 1830s, described it in his Manners and Customs of the Modern Egyptians (1836): boards of five, seven or nine rows, with twelve pieces each on the five-row board, the khamsáwee seega.',
      'The pieces, called kelbs or "dogs", go down two at a time until only the centre is empty. Then the game becomes a fight of pincers: a piece trapped between two enemies along a line is lifted off, and a player keeps capturing for as long as they can.',
      'Versions of it are still played in North Africa and the Middle East. Lane gives no rule for a game that stalls behind walls of pieces, so the table settles that by count after twenty quiet moves each.'
    ],
    facts: [['Board', '5 × 5 cups'], ['Pieces', '12 each, placed two at a time'], ['Capture', 'Trap a piece between two of yours'], ['Source', 'Edward Lane, 1836']],
    build: buildSeega },
  { id: 'tab', wing: 6, title: 'Tâb', date: 'recorded in the 1820s', rail: 'Tâb',
    eyebrow: 'Egypt · recorded by Edward Lane', status: ['known', 'Rules survive in writing'], game: 'tab',
    body: [
      'Tâb is a race and a battle at once. In Egypt it was played on four rows of squares drawn in the dust or cut in a plank, with pieces of stone on one side and red brick or tile on the other. Edward Lane recorded it in 1836, beside seega.',
      'The dice are four slips of palm stick, white on one face. One white face is a tâb, and a piece cannot leave home until its owner throws one. After that, pieces chase each other round the middle rows, knock out any enemy they land on, and may make one raid through the enemy\'s home row.',
      'Lane also describes pieces joining into stacks that split again on a tâb. The table leaves stacking out and moves each throw as it is made, to keep the game easy to follow.'
    ],
    facts: [['Board', '4 rows of 9 squares'], ['Dice', 'Four palm sticks: 1, 2, 3, 4 or 6'], ['Goal', 'Take every enemy piece'], ['Source', 'Edward Lane, 1836']],
    build: buildTab },
  { id: 'nard', wing: 6, title: 'Nard', short: 'Nard (Long Nardy)', date: 'traditional', rail: 'Nard',
    eyebrow: 'Iran, the Caucasus and Russia', status: ['known', 'Still played'], game: 'nard',
    body: [
      'Nard is the Persian branch of the tables family, and long nard, played today from Iran and Azerbaijan to Georgia, Armenia and Russia, is its most popular form. It is likely descended from nardshir, the ancient Persian game that the Tables exhibit in Wing III describes.',
      'It is played on a backgammon board, but everything else is different. All fifteen checkers start on one point, the head, and both sides run the same way round the board. Nobody hits: a single checker holds its point, so the game is about building blocks in the other player\'s path, short of a full wall of six.'
    ],
    facts: [['Board', '24 points, as backgammon'], ['Start', 'All fifteen on the head'], ['Hitting', 'None: one checker holds a point'], ['Played', 'Iran, the Caucasus, Russia']],
    build: buildNard },
  { id: 'next', wing: 6, title: 'From These Tables to Yours', short: 'Librarium', date: 'Today', rail: 'Today',
    eyebrow: 'Librarium Games', status: null,
    body: [
      'From Senet to the Landlord\'s Game, every table in this hall began with someone deciding how a game should feel. Five thousand years on, people still gather to throw dice, shuffle tiles and corner each other\'s kings, and Librarium Games carries the tradition on with tables of its own.'
    ],
    games: [
      { name: 'Phoenix Farm', url: 'https://librarium.games/phoenix-farm/', text: 'Raise magical firebirds and harvest their feathers for gold. For 1 to 6 players.' },
      { name: 'Calendra', url: 'https://librarium.games/calendra/', text: 'A Celtic game of runes, about controlling the seasons through deception.' },
      { name: 'The Great Chase', url: 'https://librarium.games/the-great-chase/', text: 'A cooperative game for 1 to 6 players that tests your teamwork.' },
      { name: 'Royal Threadcount', url: 'https://librarium.games/royal-threadcount/', text: 'Also playable online on Tabletopia.' },
    ],
    facts: [],
    link: ['Visit Librarium Games', 'https://librarium.games/'] },
];

