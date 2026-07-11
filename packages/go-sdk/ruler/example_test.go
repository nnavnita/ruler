package ruler_test

import (
	"context"
	"fmt"

	"github.com/nnavnita/ruler/packages/go-sdk/ruler"
)

func ExampleClient_Evaluate() {
	client := ruler.NewClient("http://localhost:8000")

	resp, err := client.Evaluate(
		context.Background(),
		"discount",
		map[string]any{"tier": "gold", "age": 25},
		nil,
	)
	if err != nil {
		fmt.Println("evaluate failed:", err)
		return
	}
	fmt.Printf("v%d in %v\n", resp.RuleVersion, resp.Performance)
}
