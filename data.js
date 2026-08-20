/* ==========================================================================
   what3words config
   Leave blank and the app falls back to raw GPS coordinates plus a deep
   link to what3words.com to resolve the words. That deep link pattern
   (what3words.com/<lat>,<lng>) is commonly used but hasn't been verified
   against their current site behaviour — test it before relying on it.
   For a guaranteed-accurate in-app result, register a free key at
   developer.what3words.com and paste it here. Check their current rate
   limits and consider domain-restricting the key from their dashboard,
   since this is a static site and the key is visible in the page source.
   ========================================================================== */

const W3W_API_KEY = "";

/* ==========================================================================
   SafeRoute — content data
   HOSPITALS: starter dataset only. ~28 major NHS A&E sites across England,
   Scotland and Wales, coordinates approximate. This is NOT sourced from
   the NHS Organisation Data Service and has NOT been field-verified.
   Before any public release, replace this with a verified ODS export and
   set up a refresh process — A&E departments close, relocate and merge.
   ========================================================================== */

const HOSPITALS = [
  { name: "Milton Keynes University Hospital", address: "Standing Way, Eaglestone, Milton Keynes MK6 5LD", phone: "01908660033", lat: 52.0406, lng: -0.7594 },
  { name: "John Radcliffe Hospital", address: "Headley Way, Headington, Oxford OX3 9DU", phone: "01865741166", lat: 51.7645, lng: -1.2201 },
  { name: "Luton and Dunstable University Hospital", address: "Lewsey Road, Luton LU4 0DZ", phone: "01582491166", lat: 51.8748, lng: -0.4425 },
  { name: "Bedford Hospital", address: "Kempston Road, Bedford MK42 9DJ", phone: "01234355122", lat: 52.1372, lng: -0.4739 },
  { name: "Northampton General Hospital", address: "Cliftonville, Northampton NN1 5BD", phone: "01604634700", lat: 52.2372, lng: -0.8880 },
  { name: "Stoke Mandeville Hospital", address: "Mandeville Road, Aylesbury HP21 8AL", phone: "01296315000", lat: 51.8107, lng: -0.7973 },
  { name: "St Thomas' Hospital", address: "Westminster Bridge Road, London SE1 7EH", phone: "02071887188", lat: 51.4980, lng: -0.1188 },
  { name: "The Royal London Hospital", address: "Whitechapel Road, London E1 1FR", phone: "02073777000", lat: 51.5185, lng: -0.0589 },
  { name: "St Mary's Hospital", address: "Praed Street, Paddington, London W2 1NY", phone: "02033121000", lat: 51.5177, lng: -0.1741 },
  { name: "University College Hospital", address: "235 Euston Road, London NW1 2BU", phone: "08453555000", lat: 51.5246, lng: -0.1349 },
  { name: "King's College Hospital", address: "Denmark Hill, London SE5 9RS", phone: "02073374000", lat: 51.4686, lng: -0.0933 },
  { name: "Queen Elizabeth Hospital Birmingham", address: "Mindelsohn Way, Edgbaston, Birmingham B15 2GW", phone: "01213713000", lat: 52.4530, lng: -1.9350 },
  { name: "Birmingham Heartlands Hospital", address: "Bordesley Green East, Birmingham B9 5SS", phone: "01214241000", lat: 52.4859, lng: -1.8256 },
  { name: "Leicester Royal Infirmary", address: "Infirmary Square, Leicester LE1 5WW", phone: "03001231000", lat: 52.6270, lng: -1.1362 },
  { name: "Queen's Medical Centre, Nottingham", address: "Derby Road, Nottingham NG7 2UH", phone: "01159249924", lat: 52.9399, lng: -1.1868 },
  { name: "Royal Derby Hospital", address: "Uttoxeter Road, Derby DE22 3NE", phone: "01332340131", lat: 52.9219, lng: -1.4643 },
  { name: "Manchester Royal Infirmary", address: "Oxford Road, Manchester M13 9WL", phone: "01612761234", lat: 53.4620, lng: -2.2270 },
  { name: "Salford Royal Hospital", address: "Stott Lane, Salford M6 8HD", phone: "01617894111", lat: 53.4880, lng: -2.3220 },
  { name: "Leeds General Infirmary", address: "Great George Street, Leeds LS1 3EX", phone: "01132432799", lat: 53.8027, lng: -1.5522 },
  { name: "Northern General Hospital", address: "Herries Road, Sheffield S5 7AU", phone: "01142434343", lat: 53.4084, lng: -1.4596 },
  { name: "Bristol Royal Infirmary", address: "Marlborough Street, Bristol BS2 8HW", phone: "01173923000", lat: 51.4611, lng: -2.5900 },
  { name: "Southampton General Hospital", address: "Tremona Road, Southampton SO16 6YD", phone: "02381777222", lat: 50.9330, lng: -1.4310 },
  { name: "Addenbrooke's Hospital", address: "Hills Road, Cambridge CB2 0QQ", phone: "01223245151", lat: 52.1745, lng: 0.1409 },
  { name: "Norfolk and Norwich University Hospital", address: "Colney Lane, Norwich NR4 7UY", phone: "01603286286", lat: 52.6188, lng: 1.2189 },
  { name: "Royal Victoria Infirmary", address: "Queen Victoria Road, Newcastle upon Tyne NE1 4LP", phone: "01912336161", lat: 54.9773, lng: -1.6178 },
  { name: "Glasgow Royal Infirmary", address: "84 Castle Street, Glasgow G4 0SF", phone: "01412114000", lat: 55.8629, lng: -4.2386 },
  { name: "Royal Infirmary of Edinburgh", address: "51 Little France Crescent, Edinburgh EH16 4SA", phone: "01315361000", lat: 55.9210, lng: -3.1360 },
  { name: "University Hospital of Wales", address: "Heath Park, Cardiff CF14 4XW", phone: "02920747747", lat: 51.5079, lng: -3.1791 },
];

/* ==========================================================================
   FIRST AID — original guidance, written for this app. General information
   only, not a substitute for accredited training. Always call 999 for a
   genuine emergency and start first aid while you wait if it's safe to.
   ========================================================================== */

const FIRST_AID = [
  {
    title: "Someone is choking",
    critical: true,
    steps: [
      "If they can cough, speak or breathe — encourage them to keep coughing. Don't interfere.",
      "If they can't cough, speak or breathe: lean them forward, supporting their chest with one hand. Give up to 5 sharp back blows between the shoulder blades with the heel of your other hand.",
      "Check their mouth after each blow. If the blockage hasn't cleared, give up to 5 abdominal thrusts: stand behind them, place a fist above their navel, grasp it with your other hand, and pull sharply inward and upward.",
      "Alternate 5 back blows and 5 abdominal thrusts until the object clears, they can breathe, or they become unresponsive.",
      "Call 999 if the blockage doesn't clear quickly, or if you're at all unsure. If they become unresponsive, start CPR."
    ],
    note: "Do not attempt abdominal thrusts on a pregnant woman or infant under 1 — use back blows and chest thrusts instead. Seek proper training for infant choking."
  },
  {
    title: "CPR — adult, unresponsive and not breathing normally",
    critical: true,
    steps: [
      "Check for danger, then check response — tap shoulders, ask loudly 'are you okay?'",
      "Call 999 immediately, or get someone else to while you start CPR. Ask for an AED (defibrillator) if one's nearby.",
      "Tilt the head back, lift the chin, and check for normal breathing for no more than 10 seconds. Occasional gasping is not normal breathing.",
      "If not breathing normally, kneel beside them and place the heel of one hand in the centre of the chest, other hand on top, fingers interlocked.",
      "Push hard and fast, straight down, at least 5cm deep, at a rate of 100–120 compressions per minute. Let the chest fully recoil between compressions.",
      "Continue compressions until an ambulance arrives, an AED is ready to use, or the person starts breathing normally.",
      "If trained and willing, give 30 compressions followed by 2 rescue breaths, repeating in cycles. Compression-only CPR is still effective if you're not trained in rescue breaths — don't let uncertainty stop you from starting compressions."
    ],
    note: "An AED will guide you through its own use with voice prompts. Use one as soon as it arrives — it will not shock someone who doesn't need it."
  },
  {
    title: "Severe bleeding",
    critical: true,
    steps: [
      "Call 999. Severe bleeding is a life-threatening emergency.",
      "Apply firm, direct pressure to the wound with a clean cloth, dressing, or your bare hands if nothing else is available.",
      "If possible, raise the injured area above the level of the heart while maintaining pressure.",
      "Don't remove anything embedded in the wound — apply pressure around it, not on top of it.",
      "If bleeding soaks through the dressing, add more on top rather than removing the first layer.",
      "If you have a tourniquet and are trained to use one, and bleeding from a limb cannot be controlled by pressure, apply it above the wound and note the time applied.",
      "Keep the person warm and still, and monitor them for signs of shock — pale, cold, clammy skin, rapid breathing, confusion."
    ]
  },
  {
    title: "Burns and scalds",
    critical: false,
    steps: [
      "Stop the burning process — remove the person from the heat source, and remove clothing/jewellery near the burn unless it's stuck to the skin.",
      "Cool the burn under cool (not iced) running water for 20 minutes. Start as soon as possible, even if some time has passed since the injury.",
      "Cover loosely with cling film (layered, not wrapped tightly) or a clean, non-fluffy dressing.",
      "Do not use ice, creams, oils, or butter — they can trap heat and cause more damage.",
      "Do not burst any blisters."
    ],
    note: "Call 999 or go to A&E for: burns larger than the person's palm, burns to the face, hands, feet, joints or genitals, deep burns of any size, chemical or electrical burns, or any burn on a baby or young child."
  },
  {
    title: "Seizure",
    critical: false,
    steps: [
      "Stay with them and time the seizure from when it starts.",
      "Clear the immediate area of anything they could injure themselves on. Don't try to hold them down or stop the movements.",
      "Do not put anything in their mouth.",
      "Cushion their head if you can, and once the jerking stops, roll them onto their side into the recovery position.",
      "Stay with them until they're fully recovered — they may be confused or drowsy afterward."
    ],
    note: "Call 999 if: the seizure lasts longer than 5 minutes, they have another seizure straight after, they're injured, struggling to breathe afterward, or this is their first known seizure."
  },
  {
    title: "Severe allergic reaction (anaphylaxis)",
    critical: true,
    steps: [
      "Call 999 immediately and say you suspect anaphylaxis.",
      "If they carry an auto-injector (such as an EpiPen), help them use it — or use it for them if they can't. Follow the instructions printed on the device.",
      "Lay them flat and raise their legs, unless they're struggling to breathe, in which case let them sit up in whatever position is most comfortable.",
      "If symptoms haven't improved after 5–15 minutes and a second auto-injector is available, it can be given.",
      "Watch for signs they're deteriorating — difficulty breathing, swelling of the face or throat, dizziness, or loss of consciousness — and begin CPR if they stop breathing normally."
    ]
  },
  {
    title: "Unresponsive but breathing normally",
    critical: false,
    steps: [
      "Check for danger, then check for a response.",
      "If they're breathing normally but not responding, place them in the recovery position: kneel beside them, place the arm nearest you at a right angle, bring the far arm across their chest and hold the back of their hand against their cheek.",
      "Pull the far knee up and roll them toward you onto their side, using the knee to stop them rolling too far.",
      "Tilt their head back slightly to keep the airway open, and check breathing continues.",
      "Call 999 and stay with them, monitoring breathing until help arrives."
    ]
  }
];

/* ==========================================================================
   ON FOOT — walking / pedestrian awareness
   ========================================================================== */

const WALKING = [
  {
    title: "Before you set off",
    steps: [
      "Share your live location or an ETA with someone you trust, especially at night or in an unfamiliar area.",
      "Plan your route in advance rather than navigating on the move — walking with your head down in a phone is when awareness drops most.",
      "Keep your phone charged. A dead phone removes your ability to call for help or share location.",
      "Know roughly where the nearest well-lit, populated place is along your route — a shop, station, or petrol station."
    ]
  },
  {
    title: "While you're walking",
    steps: [
      "Walk facing oncoming traffic where there's no pavement, so you can see vehicles approaching.",
      "Keep one earbud out, or headphone volume low enough to hear your surroundings.",
      "Stick to well-lit, busier routes even if they're slightly longer — predictability and low visibility are what make quiet routes riskier at night.",
      "Walk purposefully and stay aware of who's around you — check behind you occasionally rather than only looking forward.",
      "Keep valuables out of sight — phone away, bag across your body rather than loosely on one shoulder."
    ]
  },
  {
    title: "If you feel uneasy",
    steps: [
      "Trust the instinct before you've worked out why — cross the street, change direction, or head into the nearest open shop or venue.",
      "If you think you're being followed, don't go home directly — head to a public, populated place and call someone.",
      "If you're genuinely threatened, call 999. If you can't speak safely, dial 999 and press 55 when prompted — this is the Silent Solution and alerts police without you needing to talk."
    ]
  }
];

/* ==========================================================================
   ON THE MOVE — driving and public transport
   ========================================================================== */

const TRAVEL = [
  {
    title: "Driving — before a journey",
    steps: [
      "Check fuel/charge level and basic vehicle condition, especially on longer or night journeys.",
      "Keep a charged phone and, where possible, a charging cable in the car.",
      "Let someone know your route and expected arrival time on longer or late journeys."
    ]
  },
  {
    title: "Driving — if you break down",
    steps: [
      "Get the vehicle as far off the carriageway as possible — onto the hard shoulder or a layby if you can.",
      "On a motorway, exit via the left-hand door if it's safe, and stand behind the barrier, well away from the vehicle and traffic — never wait inside the car on a live carriageway.",
      "Put on a hi-vis vest if you have one, and use hazard lights.",
      "Call for recovery, or 999 if you're in a live lane and cannot get clear — this is treated as an emergency."
    ]
  },
  {
    title: "Driving — if you're followed or feel unsafe",
    steps: [
      "Don't drive home directly — head to a well-lit, populated place such as a petrol station or police station.",
      "Keep doors locked and windows up while stationary, especially at night or when approached by strangers.",
      "If someone tries to get you to stop unnecessarily (flashing lights, waving you down in an isolated spot), keep driving to the nearest safe, populated location before stopping.",
      "Call 999 if you believe you're being deliberately followed or are in danger."
    ]
  },
  {
    title: "Public transport — waiting and boarding",
    steps: [
      "Wait in well-lit areas of the platform or stop, ideally near other people or station staff.",
      "Know the exits and staffed points of the station you're in, not just the way you came in.",
      "Keep bags and phones close and visible to you, not left unattended even for a moment."
    ]
  },
  {
    title: "Public transport — during the journey",
    steps: [
      "Sit near the driver, guard, or in a busier carriage where possible, especially late at night.",
      "Stay alert to who boards and where they sit — trust discomfort even without a specific reason.",
      "If you feel unsafe or witness something concerning on a train, text the British Transport Police on 61016. It's discreet and doesn't require a phone call.",
      "For an emergency on a train or at a station, call 999 — you can also use the emergency alarm/intercom on board."
    ]
  }
];

/* ==========================================================================
   RESPOND — location sharing + in-the-moment threat guidance.
   Terrorist incident content mirrors the UK's national Run, Hide, Tell
   framework from Counter Terrorism Policing — attributed, and flagged
   for verification against the current official wording before launch.
   ========================================================================== */

const RESPOND = [
  {
    title: "Unwanted approaches or conversations",
    critical: false,
    steps: [
      "Trust the instinct before you've worked out why. You don't need a reason to end a conversation or walk away.",
      "Keep distance — don't let someone close the space between you, especially somewhere you can't see a clear exit.",
      "Keep responses short, flat and unemotional. Long explanations or arguing tends to extend the interaction, not end it.",
      "Move toward other people, staff, or a well-lit doorway rather than standing your ground to argue it out.",
      "If they follow you, head somewhere staffed — a shop, station or venue — and say clearly to a staff member: 'this person is following me.' Being visible ends most of these situations on its own.",
      "If it escalates or you feel physically unsafe, call <a href=\"tel:999\">999</a>. If you can't speak safely, dial 999 then press 55 when prompted — the Silent Solution alerts police without you needing to talk."
    ]
  },
  {
    title: "Carjacking",
    critical: true,
    steps: [
      "Give up the car if someone demands it. No vehicle is worth a confrontation — your safety comes first, every time.",
      "Move away from the vehicle and the immediate area as soon as it's safe to. Don't stay close by, and don't chase or follow the vehicle once it's taken.",
      "If you're forced into a car by a stranger, look for the first genuinely safe opportunity to get out and get away — don't hold out for a better one if a decent chance is right in front of you.",
      "Call <a href=\"tel:999\">999</a> as soon as you're safe. Give direction of travel, number of people involved, and any description you can — don't delay the call to gather more detail first.",
      "Watch for set-ups before it happens: a staged minor collision, someone flagging you down on an isolated road, being boxed in while parking. If a stop feels engineered, don't get out — drive on to a police station or busy, well-lit location instead."
    ]
  },
  {
    title: "Terrorist incident — Run, Hide, Tell",
    critical: true,
    steps: [
      "RUN — if there's a safe route away, take it. Leave belongings behind. Encourage others to come with you, but don't delay your own escape to convince them.",
      "HIDE — if you can't run, find cover that blocks sight of you and, ideally, is solid enough to stop gunfire. Lock or barricade doors where you can, move away from doors and windows, and put your phone on silent — not off.",
      "TELL — call <a href=\"tel:999\">999</a> as soon as it's safe to. Give your location, the direction of travel of the threat, number of attackers if known, and weapon type if you saw one. Don't hang up if you're told to stay on the line.",
      "If armed police reach you: keep your hands visible and empty, move slowly, avoid sudden movements, and follow instructions immediately even if they seem abrupt — they're moving fast because the threat may still be active."
    ],
    note: "Mirrors the UK's national Run, Hide, Tell counter-terrorism guidance from Counter Terrorism Policing. Verify current wording at protectuk.police.uk before relying on this in a live situation."
  },
  {
    title: "Reporting something suspicious",
    critical: false,
    steps: [
      "Trust your instinct. You don't need to be certain something's wrong to report it — that's the job of the people you report it to, not yours.",
      "For an emergency in progress, or immediate danger to life, call <a href=\"tel:999\">999</a>.",
      "For something suspicious that isn't an emergency, call the confidential Anti-Terrorist Hotline on <a href=\"tel:0800789321\">0800 789 321</a>.",
      "On a train or at a station, text British Transport Police on <a href=\"sms:61016\">61016</a> rather than calling — see the On the Move tab for more on this.",
      "Report specific behaviour, not appearance. Unusual interest in security measures or entry points, an item left unattended and unclaimed, or behaviour inconsistent with someone's stated situation are worth reporting. A person's appearance, ethnicity or religion is never a valid basis on its own — reporting based on that wastes time that should go to real leads."
    ]
  }
];
