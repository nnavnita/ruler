plugins {
    `java-library`
    `maven-publish`
}

group = "io.ruler"
version = "0.2.1"

java {
    toolchain {
        languageVersion.set(JavaLanguageVersion.of(17))
    }
    withSourcesJar()
    withJavadocJar()
}

repositories {
    mavenCentral()
}

dependencies {
    api("com.fasterxml.jackson.core:jackson-databind:2.22.1")
    api("com.fasterxml.jackson.datatype:jackson-datatype-jsr310:2.22.1")

    testImplementation("org.junit.jupiter:junit-jupiter:6.1.1")
}

tasks.test {
    useJUnitPlatform()
}

publishing {
    publications {
        create<MavenPublication>("mavenJava") {
            from(components["java"])
            pom {
                name.set("ruler-java-sdk")
                description.set("Java HTTP SDK for the Ruler rule engine service.")
                url.set("https://github.com/nnavnita/ruler")
                licenses {
                    license {
                        name.set("MIT")
                        url.set("https://opensource.org/licenses/MIT")
                    }
                }
            }
        }
    }
}
