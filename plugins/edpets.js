module.exports = {
    name: 'EdPets',
    description: 'EdPets gives players collectable pets that follow them, level up from activity, grant named stat buffs while active, and fuse into rarer pets. Its API exposes three sub-APIs — pets (give/level/slots/storage), buffs (read a player\'s active boost for a stat key and feed experience into it) and visuals (animations, held-item override, show/hide) — plus the full pet lifecycle as Bukkit events.',
    pluginId: 'EdPets',
    dependencies: `
        Java 21
    `,
    mavenIntegration: `
        <repositories>
            // SYSTEM DEPENDENCY NO REPOSITORY
        </repositories>
        <dependencies>
            <dependency>
                <groupId>es.edwardbelt</groupId>
                <artifactId>edpets-api</artifactId>
                <version>1.0</version>
                <scope>system</scope>
                <systemPath>\${basedir}/lib/EdPets.jar</systemPath>
            </dependency>
        </dependencies>
    `,
    usage: `
        /**
         * EdPets — es.edwardbelt.edpets.iapi
         *
         * Vocabulary:
         *   PET TYPE    — a configured kind of pet, identified by a String id ("dragon", "slime").
         *   PET         — one instance a player owns, identified by a UUID. A player can own many
         *                 and have several ACTIVE (following them) up to their slot count.
         *   BUFF        — a named stat key a pet grants while active. Buff keys are config-defined;
         *                 your plugin reads them by name and applies them however it wants.
         *   STORAGE     — the player's pet inventory; its size is separate from the active slots.
         *
         * The API is split into three sub-APIs, all reached from EdPetsAPI.
         */

        plugin.yml:
        \`\`\`
        name: MyPlugin
        version: 1.0
        main: com.example.MyPlugin
        api-version: '1.20'
        depend: [EdPets]
        \`\`\`

        ============================================================================
        ENTRY POINT
        ============================================================================
        \`\`\`java
        import es.edwardbelt.edpets.iapi.EdPetsAPI;

        EdPetsAPI api = EdPetsAPI.getInstance();      // null until EdPets has enabled
        var pets    = api.getPetsAPI();
        var buffs   = api.getBuffsAPI();
        var visuals = api.getVisualsAPI();
        \`\`\`

        EdPetsAPI:
        EdPetsPetsAPI getPetsAPI()
        EdPetsBuffsAPI getBuffsAPI()
        EdPetsVisualsAPI getVisualsAPI()
        static EdPetsAPI getInstance(); static void setInstance(EdPetsAPI)

        ============================================================================
        EdPetsPetsAPI — owning, levelling and slots
        ============================================================================
        List<String> getPetTypeIds()                          // every configured pet type
        void givePet(UUID playerId, String petTypeId, int level)   // grant a pet at a level
        List<String> getActivePetTypeIds(Player player)       // which TYPES they have out
        List<UUID> getActivePetIds(Player player)             // which INSTANCES they have out
        int getStoredPetCount(UUID playerId)
        int getPetLevel(UUID playerId, UUID petId)
        void addPetExperience(UUID playerId, UUID petId, BigDecimal amount)
        int getSlots(UUID playerId)                           // how many pets can be active at once
        void setSlots(UUID playerId, int slots)
        void addSlots(UUID playerId, int amount)
        int getStorageSize(UUID playerId)                     // how many pets they can hold
        void setStorageSize(UUID playerId, int size)
        void addStorageSize(UUID playerId, int amount)

        \`\`\`java
        // Give a pet as a crate/quest reward
        pets.givePet(player.getUniqueId(), "dragon", 1);

        // Unlock an extra active slot
        pets.addSlots(player.getUniqueId(), 1);

        // Feed a specific pet some experience
        for (UUID petId : pets.getActivePetIds(player)) {
            pets.addPetExperience(player.getUniqueId(), petId, BigDecimal.valueOf(50));
        }
        \`\`\`

        ============================================================================
        EdPetsBuffsAPI — reading and feeding buffs
        ============================================================================
        boolean hasBuff(Player player, String buffKey)
        BigDecimal getBoost(Player player, String buffKey)     // combined boost from every active pet
        void addExperience(Player player, String buffKey)                  // +1 activity tick
        void addExperience(Player player, String buffKey, int times)
        void addRawExperience(Player player, String buffKey, BigDecimal amount)

        This is the part most integrations need. Your plugin decides what a buff key MEANS:

        \`\`\`java
        // Apply a pet buff to your own reward
        BigDecimal bonus = buffs.getBoost(player, "mining_tokens");   // e.g. 0.35 = +35%
        BigDecimal payout = base.multiply(BigDecimal.ONE.add(bonus));

        // Only pay the pet's own levelling if the player actually has that buff
        if (buffs.hasBuff(player, "mining_tokens")) {
            buffs.addExperience(player, "mining_tokens");   // one "use" of the buff
        }
        \`\`\`
        The two addExperience overloads count activity (the pet levels from being used); use
        addRawExperience when you want to grant a precise experience amount instead.

        {IMPORTANT} Buff keys are config-defined strings shared between EdPets' configs and your
        code. Agree on the key once and use it everywhere — a typo just silently returns ZERO.
        getBoost() returns ZERO (never null) when the player has no pet granting that key.

        ============================================================================
        EdPetsVisualsAPI — cosmetics
        ============================================================================
        void playGrindAnimation(Player player, String animationId)   // the pet plays an animation
        void setHeldItemOverride(Player player, ItemStack item)      // what the pet appears to hold
        boolean isShowingPets(Player player)
        void setShowingPets(Player player, boolean showing)          // the player's hide-pets toggle

        \`\`\`java
        // Make the pet swing/mine when your plugin's action fires
        visuals.playGrindAnimation(player, "mine");
        visuals.setHeldItemOverride(player, player.getInventory().getItemInMainHand());

        // Respect the player's own hide toggle before doing anything visual
        if (visuals.isShowingPets(player)) visuals.playGrindAnimation(player, "attack");
        \`\`\`

        ============================================================================
        EVENTS (es.edwardbelt.edpets.iapi.event)
        ============================================================================
        All extend EdPetsEvent (abstract, extends org.bukkit.event.Event) and carry UUID getPlayerId().

        PetActivateEvent (Cancellable)   — a pet is being summoned
          UUID getPetId(), String getPetTypeId()
        PetDeactivateEvent               — a pet was put away
          UUID getPetId(), String getPetTypeId()
        PetLevelUpEvent                  — a pet reached a new level
          UUID getPetId(), String getPetTypeId(), int getNewLevel()
        PetExperienceGainEvent (Cancellable) — experience is about to be added
          UUID getPetId(), String getPetTypeId(), String getSourceId(),
          BigDecimal getAmount(), void setAmount(BigDecimal)     // rewritable
        PetFuseEvent                     — two pets were fused
          String getInputPetTypeId(), String getResultPetTypeId(), boolean isSuccess()
        PetMasteryEvent                  — a pet hit a mastery level
          UUID getPetId(), String getPetTypeId(), int getMasteryLevel()

        \`\`\`java
        @EventHandler
        public void onPetXp(PetExperienceGainEvent event) {
            // A weekend double-XP event, applied to every pet gain:
            if (isDoubleXpWeekend()) event.setAmount(event.getAmount().multiply(BigDecimal.TWO));
        }

        @EventHandler
        public void onLevelUp(PetLevelUpEvent event) {
            Player player = Bukkit.getPlayer(event.getPlayerId());
            if (player != null && event.getNewLevel() % 10 == 0) {
                player.sendMessage("Your " + event.getPetTypeId() + " reached level " + event.getNewLevel() + "!");
            }
        }
        \`\`\`

        ============================================================================
        PRACTICAL NOTES
        ============================================================================
        - EdPetsAPI.getInstance() returns null until EdPets has enabled. Use \`depend: [EdPets]\` and
          fetch it in onEnable, or from a delayed task.
        - Events carry a UUID, not a Player. Resolve with Bukkit.getPlayer(uuid) and null-check —
          some of these can fire while the player is logging out.
        - Pet ids are UUIDs (an instance), pet TYPE ids are Strings (a kind). getActivePetIds gives
          you the former, getActivePetTypeIds the latter; addPetExperience needs both the player and
          the pet's UUID.
        - getBoost returns a BigDecimal. Treat it as a fraction above 1 (0.35 = +35%) unless your
          configs say otherwise, and always go through BigDecimal maths for currency amounts.
        - Honour \`visuals.isShowingPets(player)\` before triggering visual effects; players who
          turned pets off do not want your animation either.
        - Events like PetExperienceGainEvent fire on whatever thread the gain happened on. Do not
          touch the Bukkit world from the listener without checking isAsynchronous().
    `
};
