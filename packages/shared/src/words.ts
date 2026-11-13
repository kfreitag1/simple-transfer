/**
 * Vocab for share ids (`share-id.ts`). IDs are haikus: `<scene>-<subject>-<verb>`, e.g. `quiet-heron-drifts`
 *
 * These lists ARE the id space: their sizes decide how hard a share link is to guess
 * Add words freely (they only make ids harder to guess), but keep every entry a
 * single lowercase ascii word of 3-12 letters, unique across all three lists
 */
const words = (list: string) =>
  list
    .trim()
    .split(/\s+/)
    .map((word) => word.trim());

export const SCENES: readonly string[] = words(`
spring summer autumn winter harvest sowing reaping solstice equinox midsummer midwinter planting
first last former latter early late belated ancient youthful newborn opening closing fading
morning evening noontide nightfall daybreak sunrise sunset moonset starfall twilight midnight dawn dusk
rainy misty foggy snowy stormy windy breezy gusty sunny drizzly cloudless overcast frosty icy humid
muggy balmy crisp arid wet damp soggy frozen thawing mild harsh bitter bleak raw sharp still
warm cool cold hot chilly tepid lukewarm scorching freezing biting numbing stinging soothing parched
pale bright dim golden amber silver bronze copper crimson scarlet azure indigo violet ivory pearly
dusky shadowed glowing gleaming flickering shimmering radiant faint hazy clear lucid glassy translucent
opal pearl ruddy tawny sable ashen chalky ochre umber russet saffron lilac mauve plum onyx
jade cyan magenta vermilion cerulean cobalt turquoise emerald sapphire amethyst topaz quartzite
quiet silent hushed muted noisy loud shrill echoing ringing humming chiming sighing murmuring rustling
whispering creaking groaning snapping crackling hissing rumbling booming wailing keening tolling drifting
smooth rough silky downy coarse gritty craggy jagged sleek glossy matte frosted weathered worn faded
polished burnished rusted tarnished gilded painted bare narrow wide broad slim tall short squat hollow
curved bent twisted straight crooked coiled spiralled arched domed tapered edged pointed blunt rounded
square oblong vast tiny little small grand mighty humble modest ample scant meagre bountiful teeming
sparse dense thick thin heavy light brittle sturdy frail delicate flimsy slack taut tight loose braided
woven knotted tethered untethered anchored adrift moored gentle tender soft kind cruel wild tame calm
serene placid tranquil peaceful restless careful careless patient hasty sudden slow fleet eager
reluctant wary bold shy timid brave fearful hopeful weary drowsy wakeful lively languid lone lonely paired
twin single double triple countless few many myriad numberless wandering floating sinking rising
falling fleeting lingering lasting eternal endless hourly daily nightly weekly seasonal yearly timeless
hidden secret open guarded shared borrowed given stolen found lost kept remembered forgotten spoken written
sung sketched drawn mapped named unnamed feral rural rustic urban coastal riverine alpine arctic boreal
tropical desert marshland forested wooded stony sandy muddy rocky mossy ferny leafy blossoming seeding
fruiting flowering withering fallen leaning climbing crawling flying swimming burrowing nesting hunting
grazing sleeping waking waiting watching listening singing dancing drumming tumbling rolling spinning
swirling churning boiling melting smoldering scorched flooded drenched sunbaked moonwashed windblown rainwashed
saltworn fogbound snowbound icebound landlocked tidal lunar solar stellar astral cosmic earthly
flaxen auburn chestnut obsidian alabaster saline briny mineral loamy peaty powdery granular
gliding swooping soaring hovering circling swerving weaving winding meandering loping bounding
leaping skipping striding strolling ambling sauntering prowling stalking creeping scurrying scampering darting
flitting fluttering scattering gathering crowding thinning spreading sprawling clinging twining branching rooting
linen cotton woollen leather wooden stone iron steel brass tin glass paper parchment clay ceramic
enamel lacquer wicker sodden clammy sticky greasy slippery spongy rubbery fibrous bristly furry feathered
scaly leathery waxy frothy foamy milky inky smudged streaked spotted striped mottled speckled dappled
flecked gravelly shingly cindery sooty smoky brackish silty clayey pebbled maroon burgundy sienna sepia khaki
taupe beige cream blush rose lemon lime mint olive sage dun
charcoal pewter chrome wan sallow pallid lurid sombre colossal immense gigantic minute wee slender
stout burly lanky portly gaunt wiry brawny lithe supple limber nimble clumsy graceful awkward deft
adroit vernal estival autumnal hibernal nocturnal matutinal vespertine crepuscular solstitial equinoctial sultry gelid torrid temperate
`);

export const SUBJECTS: readonly string[] = words(`
oak birch alder ash aspen beech cedar elm fir hawthorn hazel hemlock holly hornbeam boonoo boon boonoi bug bugnoo
juniper larch laurel linden maple pear pine plane poplar rowan sequoia spruce sycamore
walnut willow yew buckthorn crabapple tulip daffodil narcissus hyacinth crocus snowdrop bluebell
foxglove lupin poppy peony iris lily lotus orchid aster cosmos dahlia zinnia
marigold pansy viola primrose cowslip buttercup anemone clematis wisteria honeysuckle jasmine geranium
fuchsia delphinium larkspur columbine hellebore aconite gentian edelweiss campion cornflower knapweed ragwort
tansy yarrow meadowsweet loosestrife speedwell bugle saxifrage stonecrop sedum nasturtium snapdragon sunflower
moonflower corncockle cranesbill candytuft wallflower harebell basil thyme rosemary lavender fennel dill
parsley coriander cumin cardamom clove nutmeg vanilla apple peach apricot quince fig
grape currant gooseberry blackberry raspberry strawberry bilberry cranberry elderberry sloe damson medlar
mulberry persimmon pomegranate hazelnut almond acorn blackthorn heron osprey kingfisher swallow sparrow
finch wren robin lark swift hawk falcon eagle owl raven crow magpie
jay gull tern crane stork egret ibis plover sandpiper curlew woodpecker nuthatch
warbler thrush blackbird starling pigeon dove duck teal mallard goose swan pelican
cormorant puffin auk loon grebe kestrel merlin harrier kite buzzard vulture condor
albatross petrel shearwater flamingo hoopoe roller shrike wheatear redstart nightjar cuckoo quail
partridge grouse ptarmigan capercaillie snipe woodcock lapwing turnstone godwit dunlin avocet chough
pintail siskin linnet redpoll brambling fieldfare waxwing dipper whitethroat blackcap bittern crake
rail coot moorhen fox badger otter weasel stoat marten mink beaver hare
rabbit squirrel dormouse vole shrew mole hedgehog deer stag fawn elk moose
reindeer ibex chamois goat sheep ram lamb wolf coyote jackal lynx bobcat
puma panther leopard jaguar tiger lion bear bison buffalo yak camel llama
alpaca horse pony donkey mule cow bull boar mouse rat bat seal walrus
dolphin porpoise whale orca narwhal manatee marmot chipmunk lemming hamster gerbil gopher raccoon
skunk wolverine ferret bee wasp hornet ant beetle moth butterfly dragonfly damselfly
mayfly caddis firefly cricket grasshopper cicada ladybird lacewing hoverfly termite mantis earwig
weevil aphid midge gnat mosquito flea spider harvestman mite snail slug worm
leech glowworm woodlouse millipede centipede scorpion tick adder viper lizard gecko skink
newt toad frog salamander trout salmon pike perch carp eel skate ray
cod herring mackerel sardine anchovy tuna bass mullet wrasse flounder plaice sole
haddock pollock barnacle mussel oyster clam cockle scallop crab lobster shrimp krill
urchin starfish jellyfish coral sponge minnow stickleback gudgeon roach bream tench barbel
grayling char smelt sprat river stream brook creek rill well pond
lake mere tarn loch pool lagoon delta estuary fjord bay cove inlet
gulf strait channel reef shoal sandbar beach dune cliff crag tor ridge
peak summit slope valley glen dale gorge ravine canyon mesa plateau
plain prairie meadow pasture field heath moor marsh swamp bog fen mire
forest thicket grove copse jungle taiga tundra steppe savanna oasis glacier
iceberg floe avalanche volcano crater cave cavern grotto headland spit cay atoll
firth sound cloud mist fog rain drizzle shower downpour hail sleet snow
frost dew ice rime wind gale breeze gust squall storm thunder lightning
rainbow halo aurora comet meteor star moon sun zenith horizon eclipse
nebula galaxy sunbeam moonbeam starlight daylight shadow sunspot moonrise starfield snowflake raindrop hailstone
icicle snowbank ripple wave tide current eddy whirlpool waterfall cascade rapids foam
spray brine silt sand gravel pebble boulder rock crystal quartz flint granite marble
slate shale chalk loam soil mud dust pumice gypsum feldspar mica marl tufa
geode flame spark smoke soot coal cinder blaze hearth lantern candle torch
beacon bonfire campfire wildfire firewood firepit furnace kindling tinder orchard vineyard garden hedge fence
gate barn mill bridge path lane trail cottage hut cabin tower castle jetty
pier harbour quay boat canoe sail anchor rope net bell clock window door
roof chimney ladder bucket basket spade plough wheelbarrow pitchfork scythe rake hoe trowel
anvil hammer chisel loom spindle oven cauldron barrel cask jug flask pitcher kettle
village hamlet farmstead quarry mine kiln forge lighthouse windmill watermill stable byre coop
sty pen fold granary silo cellar loft attic pantry larder creamery dairy bakery
smithy workshop haystack hayloft barnyard hive nest burrow den shell feather antler
claw wing root trunk branch bark leaf petal pollen seed bud berry
thorn vine reed sedge rush cattail bracken gorse broom heather lichen kelp
algae toadstool mushroom fern moss truffle morel chanterelle puffball agaric mould twig sapling
shoot sprout tendril burr seedling stump log snag thatch straw husk chaff bramble
nettle dock sorrel plantain mallow chicory barley wheat oats rye maize millet
sorghum buckwheat lucerne vetch clover stand clump cluster puddle quagmire slough billabong riffle
freshet backwater tidepool seagrass mangrove saltmarsh moorland fenland woodland farmland grassland scrubland wetland wildwood
hedgerow riverbank streambed lakebed seabed shoreline tideline skyline ridgeline treeline snowline coastline dewpond
cairn barrow dolmen menhir fieldmouse waterfowl colt filly calf piglet chick gosling cygnet
duckling kitten puppy cub joey litter brood flock herd pack swarm school
`);

export const VERBS: readonly string[] = words(`
drifts wanders roams strays rambles meanders glides slides slips creeps crawls walks
strides marches strolls ambles saunters trudges plods staggers limps hobbles shuffles runs
sprints dashes darts races hurries hastens rushes scampers scurries leaps bounds
jumps hops skips vaults climbs scales ascends mounts scrambles clambers falls drops
descends sinks plunges dives dips stoops crouches kneels bows flies soars swoops
hovers circles wheels banks veers swerves swims wades paddles rows sails floats
surfaces breaches flows trickles streams gushes pours drips leaks seeps oozes spouts
sprays splashes ripples swells surges ebbs recedes floods overflows spills whispers murmurs
mutters mumbles rustles sighs gasps hums buzzes drones thrums rings chimes tolls
clangs echoes booms rumbles roars growls snarls hisses sings chirps trills warbles
croons coos hoots screeches squawks caws quacks honks bleats neighs whinnies barks
yelps bays howls bellows trumpets lows moos clucks cackles purrs mews glows
gleams glimmers shines flickers sparkles twinkles dazzles shimmers glints flares blazes
burns smolders gutters dims brightens darkens pales reddens whitens blackens yellows silvers
gilds grows sprouts buds blossoms blooms flowers seeds ripens withers wilts droops
bends curls twines spreads roots branches opens closes folds unfolds sleeps dozes
naps rests wakes rises breathes exhales inhales waits lingers stays remains
abides dwells lives survives thrives endures persists thinks ponders wonders muses
dreams hopes wishes longs yearns craves aches grieves mourns weeps cries sobs
laughs smiles grins chuckles frowns knows learns teaches remembers forgets recalls recognises
understands believes doubts trusts questions answers asks pleads begs thanks prays
forgives blames accuses defends argues agrees refuses accepts offers gives donates lends
borrows owes pays buys sells trades barters sees watches observes notices spies
glimpses beholds admires studies examines inspects probes tests compares judges decides chooses
picks selects rejects dismisses ignores neglects abandons quits stops ceases continues says
speaks tells recounts reports declares announces proclaims reads writes draws paints sketches
composes recites narrates translates spells makes builds crafts shapes moulds carves whittles
saws hammers forges welds binds loops twists braids weaves knits
stitches sews patches darns cuts slices chops dices peels cores hulls shells
shucks grinds crushes pounds beats whips churns mixes blends kneads bakes roasts
boils steams simmers brews ferments fries grills chars toasts sprinkles gathers collects harvests
reaps gleans stores hoards stacks piles heaps fills empties carries holds lifts
hoists hauls drags pushes pulls shoves nudges throws catches releases grips clutches
hugs embraces assembles erects raises lowers places lays sets fixes repairs mends
restores cleans washes rinses wipes sweeps polishes scrubs dusts sorts sifts sieves
filters strains drains measures weighs counts numbers labels tags names marks lists
catalogues indexes maps charts plans schedules shuts locks unlocks latches bolts nails
screws glues pastes tapes wraps eats feeds chews bites gnaws nibbles laps drinks
sips swallows tastes smells touches feels treads stamps tramps hunts stalks prowls
chases pursues flees escapes hides lurks guards protects fights battles wrestles struggles
yields surrenders attacks strikes changes turns rotates revolves spins swings rocks
quakes shudders trembles vibrates quivers shivers rattles pulses throbs expands widens narrows
stretches shrinks contracts decays rots moulders erodes wears rusts corrodes tarnishes crumbles
shatters cracks splits breaks tears rips frays arrives departs leaves enters exits
crosses passes traverses visits returns greets welcomes meets follows leads guides points
shares divides joins merges unites helps serves aids assists supports begins starts
ends finishes completes lasts rains snows hails blows gusts storms thaws freezes
warms cools chills heats lights pollinates germinates disperses migrates hibernates moults sheds
renews burrows digs scrapes scratches claws paws nests pecks preens bathes wallows
grazes browses forages scavenges suckles weans nurses tends herds shepherds stumbles trips
tumbles rolls pitches tosses lurches reels totters falters wobbles gropes fumbles grasps
seizes snatches grabs reclaims retrieves recovers finds loses keeps spends saves wastes
squanders invests earns gains profits costs charges bills budgets repays refunds tips
invoices tallies records notes documents archives files shelves huddles cowers cringes flinches
clatters clacks clicks taps knocks thumps thuds bumps crackles creaks groans squeaks squeals shrieks
wails keens whines croaks ribbits snuffles sniffs nuzzles glistens pivots swivels whirls twirls
pirouettes sashays sidles slinks sneaks tiptoes stomps clomps gurgles babbles burbles foams froths
brims wafts billows kindles singes scorches drizzles mists fogs unfurls clings trails drapes
hangs dangles sprawls lounges reclines sits stands loads unloads packs unpacks settles
untangles unravels ravels spools unwinds threads strings beads laces buttons zips buckles
straps hooks clasps clips pins stencils prints presses flattens creases shreds soaks
steeps brines pickles cures smokes dries dehydrates rehydrates refrigerates whisks ladles spoons
skewers bastes glazes garnishes plates gulps quaffs swigs milks clarifies skims curdles
leavens proves plants sows prunes grafts mulches composts weeds hoes rakes tills
ploughs threshes winnows mills fences hedges walls paves tiles thatches slates shingles
plasters shovels scoops
`);
