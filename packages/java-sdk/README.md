# ruler java client

HTTP client for the Ruler rule engine service. Java 17+, Jackson for JSON.

## Install (Gradle, Kotlin DSL)

Not yet published to Maven Central. For now, build locally and include as a project.

```kotlin
// settings.gradle.kts of the consuming project
includeBuild("../ruler/packages/java-sdk")
```

Once published, expected coords: `io.ruler:client:0.2.0`.

## Use

```java
import io.ruler.client.RulerClient;
import io.ruler.client.model.EvaluationResponse;

var client = RulerClient.create("http://localhost:8000");

var resp = client.evaluate("discount", Map.of("tier", "gold", "age", 25));
System.out.println(resp.result());       // -> {discount=0.20, tier=gold, age=25}
System.out.println(resp.performance());  // -> "312µs"
System.out.println(resp.ruleVersion());  // -> 3
```

Covers every endpoint the FastAPI reference server exposes: rules, versions + status transitions, evaluate, replay, tests, audit log.

## What's not here

**Native embedded engine.** GoRules doesn't publish an official JVM binding for zen-engine (only Node/Python/Rust/Go). A JNI wrapper around the Rust core is possible but not shipped here. HTTP hop for now.
