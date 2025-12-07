package shared

import (
	"fmt"
	"sync"
)

var (
	challengeHandlers = make(map[string]ChallengeHandler)
	mu                sync.RWMutex
)

func RegisterChallengeHandler(challengeType string, handler ChallengeHandler) {
	mu.Lock()
	defer mu.Unlock()

	if _, exists := challengeHandlers[challengeType]; exists {
		panic(fmt.Sprintf("challenge handler already registered for type: %s", challengeType))
	}

	challengeHandlers[challengeType] = handler
}

func GetChallengeHandler(challengeType string) (ChallengeHandler, bool) {
	mu.RLock()
	defer mu.RUnlock()
	handler, ok := challengeHandlers[challengeType]
	return handler, ok
}

func ListRegisteredHandlers() []string {
	mu.RLock()
	defer mu.RUnlock()

	types := make([]string, 0, len(challengeHandlers))
	for t := range challengeHandlers {
		types = append(types, t)
	}
	return types
}
