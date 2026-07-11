package ruler

import "fmt"

// APIError wraps a non-2xx HTTP response from the Ruler server.
type APIError struct {
	Status int
	Path   string
	Body   string
}

func (e *APIError) Error() string {
	return fmt.Sprintf("ruler API %d on %s: %s", e.Status, e.Path, e.Body)
}
