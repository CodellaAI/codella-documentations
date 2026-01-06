module.exports = {
    name: 'YGuard',
    description: 'YGuard is a library for obfuscating and protecting your plugin classes via Maven.',

    mavenIntegration: `
        <repositories>
            <repository>
                <id>yguard-repo</id>
                <url>https://repo.yguard.dev/releases</url>
            </repository>
        </repositories>
        <dependencies>
            <dependency>
                <groupId>com.yworks</groupId>
                <artifactId>yguard</artifactId>
                <version>4.1.1</version>
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
                                <pattern>dev.yguard</pattern>
                                <shadedPattern>your.package.yguard</shadedPattern>
                            </relocation>
                        </relocations>
                        <minimizeJar>true</minimizeJar>
                    </configuration>
                </execution>
            </executions>
        </plugin>
    `,

    usage: `
Configure YGuard entirely via Maven in your pom.xml.  

Example:

<build>
    <plugins>
        <plugin>
            <groupId>dev.yguard</groupId>
            <artifactId>yguard-maven-plugin</artifactId>
            <version>2.0.0</version>
            <executions>
                <execution>
                    <phase>package</phase>
                    <goals>
                        <goal>yguard</goal>
                    </goals>
                </execution>
            </executions>
            <configuration>
                <inputJar>\${project.build.directory}/\${project.build.finalName}.jar</inputJar>
                <outputJar>\${project.build.directory}/\${project.build.finalName}-obf.jar</outputJar>

                <!-- Never obfuscate API folder -->
                <keep>
                    <package>your.package.API.*</package>
                </keep>

                <!-- Obfuscate internal implementation -->
                <obfuscate>
                    <package>your.package.impl.*</package>
                </obfuscate>

                <renameClasses>true</renameClasses>
                <renameMethods>true</renameMethods>
                <renameFields>true</renameFields>
            </configuration>
        </plugin>
    </plugins>
</build>

Notes:
1. All classes in \`your.package.API\` remain untouched.
2. Internal implementation can be obfuscated.
3. This runs automatically during Maven package phase.
4. Test plugin after obfuscation to ensure API classes remain accessible.
    `
};
