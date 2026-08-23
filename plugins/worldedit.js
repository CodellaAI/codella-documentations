module.exports = {
    name: 'WorldEdit',
    description: 'WorldEdit (and its drop-in fork FastAsyncWorldEdit/FAWE) is the standard block-manipulation library for Bukkit. Its API is how a plugin loads and pastes .schem schematics, reads a player\'s //wand selection, and sets huge volumes of blocks fast without hammering the main thread block by block — the backbone of plot/mine/dungeon/arena generators.',
    pluginId: 'WorldEdit',
    mavenIntegration: `
        <repositories>
            <repository>
                <id>enginehub</id>
                <url>https://maven.enginehub.org/repo/</url>
            </repository>
        </repositories>
        <dependencies>
            <dependency>
                <groupId>com.sk89q.worldedit</groupId>
                <artifactId>worldedit-bukkit</artifactId>
                <version>7.3.0</version>
                <scope>provided</scope>
            </dependency>
        </dependencies>
    `,
    usage: `
        /**
         * WorldEdit — com.sk89q.worldedit
         *
         * The three things a plugin normally wants:
         *   1. Paste a .schem file into the world  (schematics)
         *   2. Read what the player selected with the wand  (selections)
         *   3. Fill/replace a big region efficiently  (EditSession)
         *
         * WorldEdit has its own type system. Bukkit types must be adapted with BukkitAdapter:
         *   BlockVector3                       instead of Location/Vector
         *   com.sk89q.worldedit.world.World    instead of org.bukkit.World
         *   BlockState / BlockType             instead of Material
         *
         * FAWE (FastAsyncWorldEdit) implements the same API. Code written against WorldEdit runs
         * unchanged on FAWE; FAWE just makes the same operations much faster and off-thread-capable.
         */

        plugin.yml:
        \`\`\`
        name: MyPlugin
        version: 1.0
        main: com.example.MyPlugin
        api-version: '1.20'
        depend: [WorldEdit]         # FAWE also registers as "FastAsyncWorldEdit"; depend on WorldEdit
        \`\`\`

        ============================================================================
        ADAPTING BUKKIT TYPES
        ============================================================================
        \`\`\`java
        import com.sk89q.worldedit.bukkit.BukkitAdapter;
        import com.sk89q.worldedit.math.BlockVector3;

        com.sk89q.worldedit.world.World weWorld = BukkitAdapter.adapt(bukkitWorld);
        BlockVector3 pos = BlockVector3.at(loc.getBlockX(), loc.getBlockY(), loc.getBlockZ());
        BlockVector3 pos2 = BukkitAdapter.asBlockVector(bukkitLocation);
        org.bukkit.World back = BukkitAdapter.adapt(weWorld);
        org.bukkit.Material mat = BukkitAdapter.adapt(blockType);
        com.sk89q.worldedit.world.block.BlockType bt = BukkitAdapter.asBlockType(Material.STONE);
        com.sk89q.worldedit.world.block.BlockState state = BukkitAdapter.adapt(bukkitBlockData);
        \`\`\`

        BlockVector3 (com.sk89q.worldedit.math) is immutable:
        static BlockVector3 at(int x, int y, int z); static BlockVector3 at(double x, double y, double z)
        int getX()/getY()/getZ() (also getBlockX/Y/Z); BlockVector3 add(...); subtract(...); multiply(...)
        BlockVector3 ZERO; double distance(BlockVector3); BlockVector3 floor()/ceil()

        ============================================================================
        SCHEMATICS — load a .schem and paste it
        ============================================================================
        \`\`\`java
        import com.sk89q.worldedit.EditSession;
        import com.sk89q.worldedit.WorldEdit;
        import com.sk89q.worldedit.bukkit.BukkitAdapter;
        import com.sk89q.worldedit.extent.clipboard.Clipboard;
        import com.sk89q.worldedit.extent.clipboard.io.ClipboardFormat;
        import com.sk89q.worldedit.extent.clipboard.io.ClipboardFormats;
        import com.sk89q.worldedit.extent.clipboard.io.ClipboardReader;
        import com.sk89q.worldedit.function.operation.Operation;
        import com.sk89q.worldedit.function.operation.Operations;
        import com.sk89q.worldedit.math.BlockVector3;
        import com.sk89q.worldedit.session.ClipboardHolder;

        public void paste(File schemFile, Location target) throws Exception {
            ClipboardFormat format = ClipboardFormats.findByFile(schemFile);
            if (format == null) throw new IllegalArgumentException("Not a schematic: " + schemFile);

            Clipboard clipboard;
            try (ClipboardReader reader = format.getReader(new FileInputStream(schemFile))) {
                clipboard = reader.read();
            }

            try (EditSession session = WorldEdit.getInstance()
                    .newEditSession(BukkitAdapter.adapt(target.getWorld()))) {

                Operation operation = new ClipboardHolder(clipboard)
                        .createPaste(session)
                        .to(BlockVector3.at(target.getBlockX(), target.getBlockY(), target.getBlockZ()))
                        .ignoreAirBlocks(true)      // don't carve holes with the schematic's air
                        .copyEntities(false)        // true also pastes armor stands/item frames
                        .copyBiomes(false)
                        .build();

                Operations.complete(operation);
            }   // try-with-resources close() FLUSHES the changes — without it nothing appears
        }
        \`\`\`

        {IMPORTANT} The EditSession must be closed (or \`flushSession()\` called). A try-with-resources
        block is the safe form — forgetting it is the single most common "my paste did nothing" bug.

        ClipboardFormats (extent.clipboard.io):
        static ClipboardFormat findByFile(File file)          // detects .schem / .schematic / .litematic
        static ClipboardFormat findByAlias(String alias)      // "sponge", "schematic", "fast", …
        static ClipboardFormat findByPath(Path path)
        static Collection<ClipboardFormat> getAll(); static String[] getFileExtensionArray()
        ClipboardFormat: ClipboardReader getReader(InputStream); ClipboardWriter getWriter(OutputStream);
          String getName(); Set<String> getAliases(); String getPrimaryFileExtension()
        BuiltInClipboardFormat.SPONGE_V3_SCHEMATIC / SPONGE_SCHEMATIC / MCEDIT_SCHEMATIC are the constants.

        Clipboard (extent.clipboard):
        Region getRegion(); BlockVector3 getDimensions();
        BlockVector3 getOrigin(); void setOrigin(BlockVector3)   // the paste anchor point
        BlockVector3 getMinimumPoint(); BlockVector3 getMaximumPoint()
        BlockState getBlock(BlockVector3); setBlock(...)

        ClipboardHolder (session):
        ClipboardHolder(Clipboard clipboard)
        Clipboard getClipboard()
        void setTransform(Transform transform)      // rotation/flip — see below
        PasteBuilder createPaste(Extent target)

        PasteBuilder (session) — chainable:
        to(BlockVector3 position)
        ignoreAirBlocks(boolean); ignoreStructureVoidBlocks(boolean)
        copyEntities(boolean); copyBiomes(boolean)
        maskSource(Mask mask); copyRegion(Region region)
        Operation build()

        --- Rotating a schematic before pasting ---
        \`\`\`java
        import com.sk89q.worldedit.math.transform.AffineTransform;

        ClipboardHolder holder = new ClipboardHolder(clipboard);
        holder.setTransform(new AffineTransform().rotateY(90));   // degrees, counter-clockwise
        // .scale(2,2,2) and negative scale for flips also work
        Operations.complete(holder.createPaste(session).to(where).ignoreAirBlocks(true).build());
        \`\`\`

        --- Saving a region to a .schem ---
        \`\`\`java
        import com.sk89q.worldedit.extent.clipboard.BlockArrayClipboard;
        import com.sk89q.worldedit.function.operation.ForwardExtentCopy;
        import com.sk89q.worldedit.regions.CuboidRegion;
        import com.sk89q.worldedit.extent.clipboard.io.BuiltInClipboardFormat;

        CuboidRegion region = new CuboidRegion(weWorld, min, max);
        BlockArrayClipboard clipboard = new BlockArrayClipboard(region);
        clipboard.setOrigin(min);

        try (EditSession session = WorldEdit.getInstance().newEditSession(weWorld)) {
            ForwardExtentCopy copy = new ForwardExtentCopy(session, region, clipboard, region.getMinimumPoint());
            copy.setCopyingEntities(false);
            Operations.complete(copy);
        }
        try (ClipboardWriter writer = BuiltInClipboardFormat.SPONGE_V3_SCHEMATIC
                .getWriter(new FileOutputStream(outFile))) {
            writer.write(clipboard);
        }
        \`\`\`

        ============================================================================
        THE PLAYER'S SELECTION (//wand)
        ============================================================================
        \`\`\`java
        import com.sk89q.worldedit.LocalSession;
        import com.sk89q.worldedit.bukkit.BukkitAdapter;
        import com.sk89q.worldedit.bukkit.WorldEditPlugin;
        import com.sk89q.worldedit.regions.Region;

        WorldEditPlugin we = (WorldEditPlugin) Bukkit.getPluginManager().getPlugin("WorldEdit");
        LocalSession session = we.getSession(player);
        com.sk89q.worldedit.world.World world = BukkitAdapter.adapt(player.getWorld());

        Region selection;
        try {
            selection = session.getSelection(world);
        } catch (IncompleteRegionException e) {
            player.sendMessage("Make a selection with //wand first.");
            return;
        }

        BlockVector3 min = selection.getMinimumPoint();
        BlockVector3 max = selection.getMaximumPoint();
        int volume = selection.getVolume();
        for (BlockVector3 pt : selection) { /* iterate every block position */ }
        \`\`\`

        Region types: CuboidRegion, Polygonal2DRegion, CylinderRegion, EllipsoidRegion, ConvexPolyhedralRegion.
        Region: BlockVector3 getMinimumPoint()/getMaximumPoint()/getCenter(); long getVolume();
          boolean contains(BlockVector3); World getWorld(); Iterator<BlockVector3> iterator()

        ============================================================================
        EDITING BLOCKS — EditSession
        ============================================================================
        \`\`\`java
        import com.sk89q.worldedit.world.block.BlockTypes;

        try (EditSession session = WorldEdit.getInstance().newEditSession(weWorld)) {
            // one block
            session.setBlock(BlockVector3.at(x, y, z), BlockTypes.STONE.getDefaultState());

            // a whole region in one call — far faster than looping setBlock yourself
            session.setBlocks(region, BlockTypes.AIR.getDefaultState());

            // replace only certain blocks
            session.replaceBlocks(region, Set.of(BlockTypes.DIRT.getDefaultState()),
                                  BlockTypes.GRASS_BLOCK.getDefaultState());

            // random mix (a mine!)
            RandomPattern pattern = new RandomPattern();
            pattern.add(BlockTypes.STONE.getDefaultState(), 0.7);
            pattern.add(BlockTypes.IRON_ORE.getDefaultState(), 0.2);
            pattern.add(BlockTypes.DIAMOND_ORE.getDefaultState(), 0.1);
            session.setBlocks(region, pattern);
        }
        \`\`\`

        EditSession (com.sk89q.worldedit):
        boolean setBlock(BlockVector3 pos, BlockStateHolder block) throws MaxChangedBlocksException
        boolean setBlock(BlockVector3 pos, Pattern pattern)
        BlockState getBlock(BlockVector3 pos)
        int setBlocks(Region region, BlockStateHolder block) / setBlocks(Region, Pattern)
        int replaceBlocks(Region region, Set<BaseBlock> from, Pattern to)
        int getBlockChangeCount(); int getBlockChangeLimit(); void setBlockChangeLimit(int limit)
        void undo(EditSession other); void redo(EditSession other)
        void flushSession(); void close()
        Also: makeCuboidFaces, makeCuboidWalls, makeSphere, makeCylinder, makePyramid, drainArea,
        fixLiquid, thaw, simulateSnow, green, and the rest of the //commands as methods.

        BlockTypes (com.sk89q.worldedit.world.block) — BlockTypes.STONE, BlockTypes.OAK_LOG, …
          .getDefaultState() gives the BlockState. BlockTypes.get("minecraft:stone") for a string id.
        Patterns (com.sk89q.worldedit.function.pattern): RandomPattern, BlockPattern, ClipboardPattern.
        Masks (com.sk89q.worldedit.function.mask): BlockTypeMask, ExistingBlockMask, RegionMask,
          Masks.negate(...) — used with maskSource on a paste or with masked operations.

        Operations (function.operation):
        static void complete(Operation op) throws WorldEditException   // run it to completion
        static void completeLegacy(Operation op) throws MaxChangedBlocksException
        static void completeBlindly(Operation op)                      // swallow errors

        ============================================================================
        THREADING AND PERFORMANCE
        ============================================================================
        - Plain WorldEdit's EditSession must be used on the MAIN THREAD. Pasting a big schematic
          synchronously will freeze the server for the duration — for anything large, either split
          the work or require FAWE.
        - FAWE (FastAsyncWorldEdit) implements the same API but is designed to be driven from an
          async thread and is orders of magnitude faster on big volumes. If your plugin routinely
          pastes large schematics (plot/mine/island generators), recommend FAWE and run the paste in
          an async task:
          \`\`\`java
          Bukkit.getScheduler().runTaskAsynchronously(plugin, () -> paste(file, target));
          \`\`\`
          Only do that when FAWE is actually installed — on vanilla WorldEdit it is unsafe.
        - Cache the loaded Clipboard. Reading the .schem file from disk on every paste is the slow
          part; a Clipboard can be pasted many times.
        - setBlocks(region, ...) beats a manual loop of setBlock: it batches chunk work.
        - Detect which one is present:
          \`\`\`java
          boolean fawe = Bukkit.getPluginManager().isPluginEnabled("FastAsyncWorldEdit");
          \`\`\`

        ============================================================================
        PRACTICAL NOTES
        ============================================================================
        - Schematic file formats: .schem is the modern Sponge format (use this), .schematic is the
          legacy MCEdit format (pre-1.13, no block states). findByFile handles both.
        - A schematic's paste position is its ORIGIN, not its corner. If pastes land offset from
          where you expect, that is the origin — set it explicitly with clipboard.setOrigin(...) or
          compute the offset from getMinimumPoint().
        - ignoreAirBlocks(true) means the schematic's air will not erase what is already there. For
          a mine or arena you usually want false so the volume is fully replaced.
        - copyEntities(true) is what carries armor stands, item frames and paintings. It is off by
          default in most builder code and is a common "my decorations didn't paste" cause.
        - MaxChangedBlocksException is thrown when an EditSession exceeds its block-change limit.
          Sessions created via newEditSession(world) are unlimited by default; ones tied to a player
          respect that player's limit — call setBlockChangeLimit(-1) for unlimited.
        - WorldGuard depends on WorldEdit and shares these types, so a plugin that touches both only
          needs to learn BlockVector3/BukkitAdapter once.
    `
};
