module.exports = {
    name: 'FancyNpcs',
    description: 'FancyNpcs creates packet-based NPCs — player-skinned or any entity type — with no real server entity behind them. Its API lets a plugin spawn NPCs in code, set skin/equipment/glow/scale, make them look at nearby players, run actions on click, and listen to interaction events. The modern, lightweight alternative to Citizens for shops, quest givers and hub decoration.',
    pluginId: 'FancyNpcs',
    mavenIntegration: `
        <repositories>
            <repository>
                <id>fancyplugins</id>
                <url>https://repo.fancyplugins.de/releases</url>
            </repository>
        </repositories>
        <dependencies>
            <dependency>
                <groupId>de.oliver</groupId>
                <artifactId>FancyNpcs</artifactId>
                <version>2.7.1</version>
                <scope>provided</scope>
            </dependency>
        </dependencies>
    `,
    usage: `
        /**
         * FancyNpcs — de.oliver.fancynpcs.api
         *
         * The model:
         *   NpcData    = the plain configuration of an NPC (id, name, skin, location, equipment…).
         *                Every setter returns \`this\`, so it builds fluently.
         *   Npc        = the live NPC built from that data. Created through the plugin's npc adapter,
         *                never with \`new\` — the concrete class is version/NMS specific.
         *   NpcManager = the registry of all NPCs (register / remove / lookup / save).
         *
         * NPCs are packet-based: nothing exists server-side, visibility is per player.
         */

        plugin.yml:
        \`\`\`
        name: MyPlugin
        version: 1.0
        main: com.example.MyPlugin
        api-version: '1.20'
        depend: [FancyNpcs]
        \`\`\`

        ============================================================================
        ENTRY POINT
        ============================================================================
        \`\`\`java
        import de.oliver.fancynpcs.api.FancyNpcsPlugin;

        FancyNpcsPlugin api = FancyNpcsPlugin.get();
        NpcManager npcs = api.getNpcManager();
        \`\`\`

        FancyNpcsPlugin (static get()):
        JavaPlugin getPlugin()
        NpcManager getNpcManager()
        AttributeManager getAttributeManager()          // entity-type specific attributes (pose, variant…)
        ActionManager getActionManager()                // the click-action registry
        SkinManager getSkinManager()                    // skin fetching/caching
        FancyNpcsConfig getFancyNpcConfig()
        Function<NpcData, Npc> getNpcAdapter()          // THE factory — how you build an Npc
        ScheduledExecutorService getNpcThread(); FancyScheduler getScheduler()

        NpcManager:
        void registerNpc(Npc npc)
        void removeNpc(Npc npc)
        Npc getNpc(String name)
        Npc getNpcById(String id)
        Npc getNpc(int entityId)
        Npc getNpc(String name, UUID creator)
        Collection<Npc> getAllNpcs()
        void saveNpcs(boolean force)                    // persist to npcs.yml
        void loadNpcs(); void reloadNpcs()

        ============================================================================
        CREATING AN NPC
        ============================================================================
        \`\`\`java
        import de.oliver.fancynpcs.api.*;
        import de.oliver.fancynpcs.api.utils.NpcEquipmentSlot;
        import net.kyori.adventure.text.format.NamedTextColor;
        import org.bukkit.entity.EntityType;
        import org.bukkit.inventory.ItemStack;
        import org.bukkit.Material;

        NpcData data = new NpcData("shopkeeper", player.getUniqueId(), location);
        data.setDisplayName("<gold><bold>Shopkeeper")        // MiniMessage
            .setSkin("Notch")                                // player name, UUID or texture URL
            .setType(EntityType.PLAYER)
            .setShowInTab(false)
            .setCollidable(false)
            .setGlowing(true)
            .setGlowingColor(NamedTextColor.GOLD)
            .setTurnToPlayer(true)
            .setTurnToPlayerDistance(10)
            .setInteractionCooldown(0.5f)
            .setVisibilityDistance(32)
            .setScale(1.0f)
            .addEquipment(NpcEquipmentSlot.MAINHAND, new ItemStack(Material.EMERALD))
            .addEquipment(NpcEquipmentSlot.HEAD, new ItemStack(Material.DIAMOND_HELMET))
            .setOnClick(clicker -> clicker.performCommand("shop"));

        Npc npc = FancyNpcsPlugin.get().getNpcAdapter().apply(data);
        npc.create();                                        // build the packet entity
        npc.spawnForAll();                                   // show it to everyone in range
        FancyNpcsPlugin.get().getNpcManager().registerNpc(npc);
        FancyNpcsPlugin.get().getNpcManager().saveNpcs(true); // only if it should survive restarts
        \`\`\`

        {IMPORTANT} Never \`new\` an Npc — the concrete implementation is NMS-version specific.
        Always go through \`FancyNpcsPlugin.get().getNpcAdapter().apply(data)\`.
        And call \`create()\` before any spawn/update, or the NPC has no backing packet entity.

        ============================================================================
        NpcData — the configuration (every setter returns NpcData)
        ============================================================================
        NpcData(String id, UUID creator, Location location)   // the short constructor you want
        String getId(); String getName(); UUID getCreator()
        String getDisplayName();          setDisplayName(String)     // MiniMessage; "<empty>" hides it
        SkinData getSkinData();           setSkinData(SkinData)
                                          setSkin(String identifier)  // name / UUID / texture URL
                                          setSkin(String identifier, SkinData.SkinVariant variant) // SLIM | CLASSIC
        Location getLocation();           setLocation(Location)
        EntityType getType();             setType(EntityType)         // PLAYER, or any mob type
        boolean isShowInTab();            setShowInTab(boolean)       // appear in the player list
        boolean isSpawnEntity();          setSpawnEntity(boolean)
        boolean isCollidable();           setCollidable(boolean)
        boolean isGlowing();              setGlowing(boolean)
        NamedTextColor getGlowingColor(); setGlowingColor(NamedTextColor)
        Map<NpcEquipmentSlot, ItemStack> getEquipment();
                                          setEquipment(Map<...>)
                                          addEquipment(NpcEquipmentSlot slot, ItemStack item)
        Consumer<Player> getOnClick();    setOnClick(Consumer<Player>)  // simplest click handler
                                          setTurnToPlayer(boolean)
                                          setTurnToPlayerDistance(int)
                                          setInteractionCooldown(float seconds)
                                          setVisibilityDistance(int blocks)
                                          setScale(float)
                                          setMirrorSkin(boolean)        // wear the viewer's own skin
                                          setActions(ActionTrigger, List<NpcActionData>)
                                          addAction(ActionTrigger trigger, int order, NpcAction action, String value)

        NpcEquipmentSlot: MAINHAND, OFFHAND, HEAD, CHEST, LEGS, FEET
        ActionTrigger: ANY_CLICK, LEFT_CLICK, RIGHT_CLICK, CUSTOM

        ============================================================================
        Npc — the live NPC
        ============================================================================
        void create()                                  // build it; call once, before spawning
        void spawn(Player viewer); void spawnForAll()
        void remove(Player viewer); void removeForAll()
        void update(Player viewer); void updateForAll()   // re-send after changing NpcData
        void move(Player viewer, boolean swingArm); void moveForAll()
        void lookAt(Player viewer, Location target)
        void checkAndUpdateVisibility(Player viewer)
        void interact(Player player); void interact(Player player, ActionTrigger trigger)
        int getEntityId(); float getEyeHeight()
        NpcData getData()                              // mutate, then updateForAll()
        boolean isDirty(); void setDirty(boolean)
        boolean isSaveToFile(); void setSaveToFile(boolean)   // false = a temporary/session NPC
        Map<UUID, Boolean> getIsVisibleForPlayer(); getIsLookingAtPlayer(); getIsTeamCreated()
        Map<UUID, Long> getLastPlayerInteraction()

        --- Changing an existing NPC ---
        \`\`\`java
        Npc npc = FancyNpcsPlugin.get().getNpcManager().getNpcById("shopkeeper");
        if (npc != null) {
            npc.getData().setDisplayName("<red>Closed").setGlowing(false);
            npc.updateForAll();                        // ALWAYS push the change to viewers
        }
        \`\`\`

        --- Moving one ---
        \`\`\`java
        npc.getData().setLocation(newLocation);
        npc.moveForAll();
        \`\`\`

        --- Removing one ---
        \`\`\`java
        npc.removeForAll();
        FancyNpcsPlugin.get().getNpcManager().removeNpc(npc);
        FancyNpcsPlugin.get().getNpcManager().saveNpcs(true);
        \`\`\`

        ============================================================================
        EVENTS (de.oliver.fancynpcs.api.events)
        ============================================================================
        NpcInteractEvent        — a player clicked an NPC. Npc getNpc(), Player getPlayer(),
                                  ActionTrigger getInteractionType(). Cancellable.
        NpcCreateEvent          — an NPC is being created. Cancellable.
        NpcRemoveEvent          — an NPC is being removed. Cancellable.
        NpcModifyEvent          — a property is being changed (also fires for /npc commands).
                                  Cancellable; carries the modification type and new value.
        NpcSpawnEvent           — an NPC is being shown to a player. Cancellable.
        NpcStartLookingEvent / NpcStopLookingEvent — the turn-to-player state changed.
        NpcsLoadedEvent         — all NPCs finished loading from disk. The right place to look up
                                  your NPCs on startup — before it, getNpcById returns null.
        PacketReceivedEvent     — low-level packet hook.

        \`\`\`java
        @EventHandler
        public void onInteract(NpcInteractEvent event) {
            if (!event.getNpc().getData().getId().equals("shopkeeper")) return;
            if (event.getInteractionType() != ActionTrigger.RIGHT_CLICK) return;
            openShop(event.getPlayer());
        }
        \`\`\`

        ============================================================================
        PRACTICAL NOTES
        ============================================================================
        - Do your lookups after NpcsLoadedEvent, not in onEnable. NPCs load asynchronously from
          npcs.yml, so getNpcById() in onEnable will usually return null.
        - setSaveToFile(false) for NPCs your plugin recreates at runtime (per-player, per-arena,
          temporary). Otherwise they accumulate in npcs.yml and get restored as orphans.
        - After ANY NpcData change you must call updateForAll() (or update(player)); the data object
          is inert on its own.
        - Display names are MiniMessage, not legacy colour codes. "<red>Text", not "&cText". Use
          "<empty>" to hide the name tag entirely.
        - setSkin(...) hits Mojang's API when the skin is not cached; it is asynchronous, so the NPC
          may briefly show the default skin. Do not call it in a tight loop — you will get rate-limited.
        - Visibility is per player. A viewer out of visibilityDistance simply never receives the
          packets; checkAndUpdateVisibility(player) forces a re-evaluation.
        - setOnClick(Consumer) is the quickest handler, but it is NOT persisted to npcs.yml — it only
          lives as long as your plugin's object. For NPCs that survive restarts use actions
          (addAction) or an NpcInteractEvent listener keyed on the NPC id.
        - FancyNpcs is Paper-oriented and folia-aware; use its getScheduler() if you need to schedule
          work that must be correct on Folia.
    `
};
