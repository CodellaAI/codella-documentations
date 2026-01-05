module.exports = {
    name: 'Sentinel',
    description: 'Sentinel is a powerful system which allows you to add a license to your plugin.',

    mavenIntegration: `
        <repositories>
            <repository>
                <id>demeng-repo</id>
                <name>Demeng's Repository</name>
                <url>https://repo.demeng.dev/releases</url>
            </repository>
        </repositories>
        <dependencies>
            <dependency>
                <groupId>dev.demeng</groupId>
                <artifactId>sentinel-java-wrapper</artifactId>
                <version>1.3.0</version>
                <scope>compile</scope>
            </dependency>
        </dependencies>
    `,

    mavenShade: `
        <plugin>
            <groupId>org.apache.maven.plugins</groupId>
            <artifactId>maven-shade-plugin</artifactId>
            <version>3.4.1</version>
            <executions>
                <execution>
                    <phase>package</phase>
                    <goals>
                        <goal>shade</goal>
                    </goals>
                    <configuration>
                        <relocations>
                            <relocation>
                                <pattern>dev.demeng.sentinel</pattern>
                                <shadedPattern>your.package.sentinel</shadedPattern>
                            </relocation>
                        </relocations>
                    </configuration>
                </execution>
            </executions>
        </plugin>
    `,

    usage: `
	Create Utils/LicenseAuthenticator.

	Imports:
	import dev.demeng.sentinel.wrapper.SentinelClient;
	import dev.demeng.sentinel.wrapper.exception.*;
	import dev.demeng.sentinel.wrapper.exception.unchecked.UnexpectedResponseException;

	Static setup:

	private static final SentinelClient sentinel = new SentinelClient(
		"AUTH_URL/api/v1",
		"API_KEY",
		"SECRET_KEY"
	);

	private static final String key = MainClass.getConfig().getString("license");
	private static final String ID = "%%__USER__%%";

	public static boolean checkLicense() {
		boolean manual = ID.contains("__USER__");

		try {
			if (!manual) {
				sentinel.getLicenseController().auth(
					null,
					"PLUGIN_NAME",
					"PLATFORM_BUILTBYBIT_OR_SPIGOT_OR_POLYMART",
					ID,
					SentinelClient.getCurrentHwid(),
					SentinelClient.getCurrentIp()
				);
			} else {
				sentinel.getLicenseController().auth(
					key,
					"PLUGIN_NAME",
					null,
					null,
					SentinelClient.getCurrentHwid(),
					SentinelClient.getCurrentIp()
				);
			}
			return true;

		} catch (InvalidLicenseException e) {
			Bukkit.getLogger().warning("This license is invalid.");
			return false;

		} catch (ExpiredLicenseException e) {
			Bukkit.getLogger().warning("This license has expired.");
			return false;

		} catch (BlacklistedLicenseException e) {
			Bukkit.getLogger().warning("This license is blacklisted.");
			return false;

		} catch (ExcessiveServersException e) {
			Bukkit.getLogger().warning("This license is used by too many servers. (Max: " + e.getMaxServers() + ")");
			return false;

		} catch (ExcessiveIpsException e) {
			Bukkit.getLogger().warning("This license is used by too many IPs. (Max: " + e.getMaxIps() + ")");
			return false;

		} catch (InvalidProductException e) {
			Bukkit.getLogger().warning("This license is linked to a different product.");
			return false;

		} catch (InvalidPlatformException e) {
			Bukkit.getLogger().warning("This license is not linked to your download id.");
			return false;

		} catch (UnexpectedResponseException | IOException e) {
			Bukkit.getLogger().severe("License verification failed unexpectedly. Contact plugin developer ASAP.");
			return false;

		} catch (ConnectionMismatchException e) {
			Bukkit.getLogger().severe("This license is not connected to the jar.");
			Bukkit.getPluginManager().disablePlugin(wTags.getInstance());
			return false;
		}
	}


	Main class (onEnable):

	if (!LicenseAuthenticator.checkLicense()) {
		Bukkit.getPluginManager().disablePlugin(this);
		return;
	}
	
	Other information:
	
	    The license is usually stored in your config.yml file under "license" option at the very top of config. Make sure by default it is "key-goes-here".
		This may be "key-goes-here" or null IF the user downloads it from a market place and uses the placeholder injection, in which case, they must have "auto-create-license" option enabled for their product on Sentinel config files. Tell them that it must be enabled to use this feature.
        So, if the license is invalid or it has expired or it has reached the maximum amounts of IP addresses it will return false on checkLicense method.
		Now you must go to the LicenseAuthenticator file and edit "PLUGIN_NAME" option two times with the name of the plugin project.
        Once you've set up Sentinel, tell the user to go to the LicenseAuthenticator file and fill out the AUTH_URL, API_KEY (Client Key NOT Admin Key!), SECRET_KEY, and which platform they are using.
    `
};
