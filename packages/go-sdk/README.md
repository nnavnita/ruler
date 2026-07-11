# ruler go SDK

Native Go client for the Ruler rule engine service.

```bash
go get github.com/nnavnita/ruler/packages/go-sdk/ruler
```

```go
package main

import (
    "context"
    "fmt"

    "github.com/nnavnita/ruler/packages/go-sdk/ruler"
)

func main() {
    client := ruler.NewClient("http://localhost:8000")

    resp, err := client.Evaluate(
        context.Background(),
        "discount",
        map[string]any{"tier": "gold", "age": 25},
        nil,
    )
    if err != nil {
        panic(err)
    }
    fmt.Printf("v%d result=%s perf=%v\n", resp.RuleVersion, resp.Result, resp.Performance)
}
```

Covers every endpoint the FastAPI reference server exposes: rules, versions + status transitions, evaluate, replay, tests, audit log.

## What's not here yet

**Native embedded engine.** GoRules ships a Go binding at `github.com/gorules/zen-go` (cgo). Wiring it into a `NativeEngine` struct that mirrors this HTTP `Client` is planned. Requires cgo at consumer build time, so it will live behind a build tag.
