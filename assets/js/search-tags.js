// Extra search words for every tile on the home page, keyed by the tile's href.
// These are the words a student might type when they do not know what a tool is called:
// "cartoon" should find the animation tools, "beat" should find the music ones.
// A tile with no entry here is still searchable by its title, tag line, and description.
// When you add a tile to index.html, add a line here with the same href.
window.LENS_TAGS = {
  "gallery/paper-flipbook.html": [
    "flipbook", "flip book", "paper", "draw on paper", "pencil", "sketch", "doodle", "cartoon", "animation", "animate",
    "gif", "make a gif", "moving picture", "frames", "frame by frame", "grid", "printable", "print", "worksheet",
    "phone camera", "photo", "scan", "sprite sheet", "game sprite", "video", "loop", "hand drawn", "traditional animation",
    "no ipad", "no computer", "cheap", "beginner", "easy", "kids", "comic", "storyboard", "motion", "zoetrope",
    "动画", "애니메이션", "animación", "dibujo"
  ],
  "gallery/handwriting-font.html": [
    "font", "fonts", "typeface", "typography", "type", "lettering", "letters", "alphabet", "handwriting", "my handwriting",
    "own font", "custom font", "install font", "ttf", "otf", "calligraphy", "hand lettering", "pen", "write", "writing",
    "signature", "title card", "poster", "album art", "album cover", "logo", "branding", "graphic design", "text",
    "printable", "scan", "phone camera", "personal", "design", "字体", "폰트", "letra", "fuente"
  ],
  "https://brush.ninja/": [
    "brush ninja", "pixel", "pixel art", "8 bit", "retro", "video game art", "sprite", "animation", "animate", "cartoon",
    "gif", "make a gif", "frame by frame", "onion skin", "draw", "drawing", "doodle", "sketch", "paint", "free",
    "browser", "online", "no download", "quick", "simple", "beginner", "easy", "loop", "meme", "sticker", "emoji",
    "external", "website"
  ],
  "gallery/flipbook-lab.html": [
    "flipbook", "animation", "animate", "cartoon", "anime", "2d animation", "drawing", "draw", "paint", "sketch",
    "frame by frame", "onion skin", "keyframe", "keyframes", "tween", "motion", "stop motion", "camera", "webcam",
    "claymation", "lego", "layers", "shapes", "gif", "video", "mp4", "export", "studio", "laptop", "browser", "free",
    "no install", "private", "offline", "character", "walk cycle", "bouncing ball", "music video", "short film",
    "动画", "애니메이션", "animación", "dibujos animados"
  ],
  "gallery/pocket-loops.html": [
    "pocket loops", "phone", "iphone", "android", "mobile", "one hand", "thumb", "loop", "loops", "looping", "animation",
    "animate", "cartoon", "gif", "doodle", "draw", "sketch", "frame by frame", "onion skin", "tempo", "bpm", "rhythm",
    "in time", "beat", "stop motion", "photo", "camera", "color picker", "eyedropper", "steal colors", "straight lines",
    "background", "layers", "video", "ten second video", "instagram", "tiktok", "reel", "story", "on the go", "bus", "subway"
  ],
  "gallery/timeline-maker.html": [
    "timeline", "time line", "history", "dates", "chronology", "chronological", "order", "events", "story", "storytelling",
    "biography", "life story", "my life", "autobiography", "memoir", "career", "artist history", "music history",
    "compare", "two lives", "photos", "pictures", "slideshow", "presentation", "project", "infographic", "visual",
    "spiral", "wave", "board game", "path", "map", "png", "export", "poster", "school project", "essay", "research"
  ],
  "gallery/loopgrid.html": [
    "loopgrid", "loop", "looper", "looping", "loop station", "loop pedal", "rc-505", "boss", "beatbox", "beat box", "beat", "beats", "make beats",
    "a cappella", "acapella", "layer", "layers", "multitrack", "one man band", "jacob collier", "video", "webcam",
    "record", "recording", "record yourself", "split screen", "grid", "tiles", "music video", "performance", "tempo",
    "click", "metronome", "count in", "bpm", "spacebar", "mac app", "download", "singing", "voice", "vocals", "jam",
    "covers", "instagram", "tiktok"
  ],
  "gallery/ink-to-3d.html": [
    "3d", "3d model", "3d print", "3d printing", "model", "mesh", "glb", "obj", "blender", "handwriting", "name",
    "my name", "signature", "letters", "lettering", "typography", "calligraphy", "sculpture", "extrude", "depth",
    "photo", "phone camera", "pen", "ink", "drawing to 3d", "sketch to 3d", "logo", "sign", "spin", "turntable",
    "download", "game asset", "unity", "ar", "augmented reality", "3d 模型", "3D 모델"
  ],
  "gallery/zooparty.html": [
    "zooparty", "zoetrope", "praxinoscope", "phenakistoscope", "record", "vinyl", "turntable", "spin", "spinning",
    "strobe", "circle", "disc", "animation", "animate", "cartoon", "loop", "ipad", "apple pencil", "pencil", "draw",
    "drawing", "frames", "echo", "photos", "print", "printable", "old school", "history of animation",
    "optical illusion", "illusion", "persistence of vision", "dj", "record player", "physical", "craft"
  ],
  "guides/procreate-stop-motion.html": [
    "procreate", "stop motion", "stopmotion", "animation assist", "animate", "animation", "cartoon", "ipad",
    "apple pencil", "tutorial", "tutorials", "how to", "video", "youtube", "lesson", "learn", "beginner", "onion skin",
    "frames", "gif", "week 2", "week 3", "assignment", "homework", "crit", "critique", "vocabulary", "motion design",
    "guide", "help", "walkthrough", "claymation"
  ],
  "guides/exploring-digital-art-making.html": [
    "free tools", "browser tools", "online tools", "websites", "list", "resources", "links", "explore", "inspiration",
    "ideas", "bored", "play", "fun", "creative coding", "code", "coding", "programming", "javascript", "p5", "p5.js",
    "processing", "openprocessing", "hydra", "live coding", "vj", "visuals", "generative art", "generative",
    "algorithm", "weave silk", "symmetry", "kaleidoscope", "patatap", "chrome music lab", "music toys",
    "google experiments", "google arts and culture", "autodraw", "quick draw", "ai drawing", "monster mash",
    "cloud stop motion", "photopea", "photoshop", "free photoshop", "photo editing", "edit photos", "pixlr", "filters",
    "remove background", "remove.bg", "cut out", "font playground", "variable fonts", "recursive", "animated text",
    "kinetic type", "kinetic typography", "typeflow", "adobe express", "adobe", "canva", "weeks 1 through 5"
  ],
  "https://kramermusician.github.io/daily-graphs/": [
    "graph", "graphs", "daily graph", "chart", "charts", "data", "data viz", "data visualization", "infographic",
    "statistics", "stats", "numbers", "math", "science", "facts", "fun facts", "trivia", "compare", "comparison",
    "side by side", "juxtaposition", "surprising", "microchips", "sprinters", "planets", "playlists", "class slides",
    "from class", "reading", "articles", "sources", "learn more", "curiosity", "news", "图表", "그래프"
  ],
  "guides/procreate.html": [
    "procreate", "playlist", "videos", "youtube", "tutorial", "tutorials", "how to", "lesson", "learn", "beginner",
    "ipad", "apple pencil", "draw", "drawing", "digital drawing", "digital painting", "paint", "illustration",
    "animation", "animate", "cartoon", "cute", "ghost", "floating ghost", "halloween", "simple animation", "gif",
    "character", "sticker", "16 videos", "step by step", "follow along"
  ],
  "https://apps.apple.com/us/app/procreate/id425073498": [
    "procreate", "buy procreate", "download procreate", "get procreate", "app store", "apple", "ipad", "app", "install",
    "price", "cost", "how much", "purchase", "one time", "no subscription", "savage interactive", "drawing app",
    "painting app", "art app", "illustration app", "animation app", "external", "store"
  ],
  "guides/blender.html": [
    "blender", "3d", "3d modeling", "modeling", "modelling", "3d animation", "3d art", "render", "rendering",
    "sculpt", "sculpting", "donut", "blender donut", "playlist", "videos", "youtube", "tutorial", "tutorials", "how to",
    "beginner", "absolute beginner", "first time", "controls", "navigation", "move around", "camera", "viewport",
    "shortcuts", "learn", "lesson", "pixar", "cgi", "game", "video game", "free software", "mac", "windows", "3d 动画", "블렌더"
  ],
  "guides/blender-templates.html": [
    "blender", "templates", "template", "starter files", "starter", "project files", "download", ".blend", "blend file",
    "examples", "scenes", "3d", "letter smash", "room", "redecorate", "interior", "primitive pal", "character",
    "glowing name sign", "neon", "neon sign", "name", "orbit", "orbit system", "planets", "solar system", "orbit text",
    "follow the path", "path", "letter tower", "flower garden", "flowers", "cloth", "cloth drop", "cloth simulation",
    "physics", "simulation", "array spiral", "array", "spiral", "screenshots", "remix", "start here", "class opener"
  ],
  "https://www.blender.org/": [
    "blender", "blender.org", "download blender", "install blender", "get blender", "free", "free software",
    "open source", "3d", "3d software", "manual", "documentation", "docs", "help", "release notes", "version",
    "update", "mac", "windows", "linux", "official site", "external"
  ],
  "guides/cavalry.html": [
    "cavalry", "motion design", "motion graphics", "mograph", "after effects", "after effects alternative",
    "2d animation", "animation", "animate", "shapes", "duplicator", "duplicators", "behaviours", "behaviors",
    "procedural", "nodes", "generative", "pattern", "patterns", "loop", "loops", "voxel", "voxelized type",
    "kinetic type", "kinetic typography", "animated text", "text animation", "cycling letters", "audio reactive",
    "sound reactive", "music visualizer", "visualizer", "lyric video", "music video", "playlist", "videos", "youtube",
    "tutorial", "tutorials", "beginner", "how to", "free version"
  ],
  "https://cavalry.studio/": [
    "cavalry", "cavalry.studio", "download cavalry", "install cavalry", "get cavalry", "free version", "free",
    "motion design", "motion graphics", "after effects alternative", "software", "mac", "windows", "official site",
    "external", "license", "student"
  ],
  "gallery/blues-randomizer.html": [
    "blues", "12 bar blues", "twelve bar blues", "12-bar", "midterm", "exam", "test", "practice", "study",
    "dice", "random", "randomizer", "key", "keys", "tempo", "feel", "groove", "shuffle", "swing", "backing track",
    "play along", "jam track", "beat", "beats", "drums", "band", "improvise", "improvisation", "solo", "soloing", "instrument", "practice tool",
    "web audio", "synth", "ear training", "chords", "I IV V", "1 4 5", "布鲁斯", "블루스"
  ],
  "gallery/twelve-blocks.html": [
    "twelve blocks", "12 blocks", "blues", "12 bar blues", "twelve bar blues", "neighborhood", "city", "buildings",
    "walk", "walking", "street", "crosswalk", "barlines", "bars", "measures", "chords", "chord changes", "form",
    "song form", "structure", "major blues", "minor blues", "any key", "grooves", "band", "synth", "animation",
    "animated", "visualization", "music visualization", "week 6", "assignment", "example", "model", "canvas"
  ],
  "gallery/scales-and-chords-blues.html": [
    "scales", "scale", "major scale", "mixolydian", "modes", "mode", "chords", "chord", "triads", "seventh chords",
    "dominant 7", "dom7", "scale degrees", "harmony", "music theory", "theory", "blues", "12 bar blues", "bass",
    "bass diagram", "piano", "keyboard", "fretboard", "guitar", "notes", "keys", "every key", "slides", "slideshow",
    "deck", "week 3", "lesson", "lecture", "review", "study", "midterm", "乐理", "음악 이론", "teoría musical"
  ],
  "gallery/key-party.html": [
    "key party", "game", "games", "party game", "multiplayer", "2 players", "4 players", "friends", "compete",
    "competition", "race", "gamepad", "controller", "ps4", "playstation", "xbox", "music theory", "theory",
    "key signatures", "sharps", "flats", "scales", "notes", "chords", "find the chord", "lava", "floor is lava",
    "12 bar blues", "blues", "midterm", "study", "practice", "fun", "week 6", "arcade"
  ],
  "gallery/chord-drop.html": [
    "chord drop", "chord chart", "chart", "lead sheet", "chords", "chord changes", "song", "songwriting",
    "write a song", "my song", "band", "rehearsal", "gig", "cover", "rhythm", "rhythm section", "drum groove", "drums",
    "metronome", "tap", "tap tempo", "spacebar", "beat", "bars", "measures", "slash notation", "print", "pdf",
    "repeat signs", "song form", "verse", "chorus", "bridge", "nashville numbers", "guitar", "piano", "bass", "web audio"
  ],
  "gallery/score-sketch.html": [
    "score sketch", "sheet music", "notation", "music notation", "staff", "notes", "write music", "compose",
    "composing", "composition", "arranging", "arrangement", "melody", "transcribe", "transcription", "typing",
    "keyboard", "letter names", "two voices", "harmony", "repeats", "dynamics", "key signature", "time signature",
    "playback", "hear it", "print", "pdf", "musicxml", "musescore", "noteflight", "sibelius", "finale", "dorico",
    "lead sheet", "homework", "theory", "乐谱", "악보", "partitura"
  ],
  "gallery/speech-silhouette.html": [
    "speech silhouette", "webcam", "camera", "body", "silhouette", "shadow", "dance", "dancing", "movement",
    "performance", "voice", "speech", "speak", "talk", "words", "text", "typography", "kinetic type", "live",
    "interactive", "installation", "interactive art", "new media", "speech to text", "transcription", "microphone",
    "mic", "languages", "multilingual", "poetry", "spoken word", "rap", "lyrics", "letters", "explode", "video",
    "record", "art installation", "touchdesigner", "ai", "computer vision"
  ]
};
