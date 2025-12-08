package main

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"flag"
	"net/http"
	"os"

	"github.com/gin-contrib/cors"
	"github.com/gin-contrib/sessions"
	"github.com/gin-contrib/sessions/cookie"
	"github.com/gin-gonic/gin"
	"github.com/pwnthemall/pwnthemall/backend/config"
	"github.com/pwnthemall/pwnthemall/backend/debug"
	_ "github.com/pwnthemall/pwnthemall/backend/handlers" // MANDATORY to launch init() func and register challenge type handlers
	"github.com/pwnthemall/pwnthemall/backend/pluginsystem"
	"github.com/pwnthemall/pwnthemall/backend/routes"
	"github.com/pwnthemall/pwnthemall/backend/utils"
)

// CLI flags for seeding operations
var (
	seedDemo      = flag.Bool("seed-demo", false, "Seed the database with demo teams, users, and solves")
	cleanDemo     = flag.Bool("clean-demo", false, "Remove all demo data from the database")
	seedTeams     = flag.Int("teams", 30, "Number of demo teams to create (default: 30)")
	seedTimeRange = flag.Int("time-range", 20, "Time range in hours for spreading solve timestamps (default: 20)")
)

func generateRandomString(n int) (string, error) {
	bytes := make([]byte, n)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return hex.EncodeToString(bytes), nil
}

// initWebSocketHub initializes the WebSocket hubs
func initWebSocketHub() {
	utils.WebSocketHub = utils.NewHub()
	go utils.WebSocketHub.Run()

	utils.UpdatesHub = utils.NewHub()
	go utils.UpdatesHub.Run()
}

func main() {
	flag.Parse()

	// Handle CLI seeding commands (requires only DB connection)
	if *seedDemo || *cleanDemo {
		config.ConnectDB()

		if *cleanDemo {
			debug.Println("Running: clean-demo")
			if err := config.CleanDemoData(); err != nil {
				debug.Log("Failed to clean demo data: %v", err)
				os.Exit(1)
			}
			debug.Println("Demo data cleaned successfully")
			os.Exit(0)
		}

		if *seedDemo {
			debug.Log("Running: seed-demo (teams=%d, time-range=%dh)", *seedTeams, *seedTimeRange)
			if err := config.SeedDemoData(*seedTeams, *seedTimeRange); err != nil {
				debug.Log("Failed to seed demo data: %v", err)
				os.Exit(1)
			}
			debug.Println("Demo data seeded successfully")
			os.Exit(0)
		}
	}

	config.ConnectDB()
	config.ConnectMinio()
	config.InitCasbin()

	if err := config.ConnectDocker(); err != nil {
		debug.Log("Failed to connect to docker host: %s", err.Error())
	}

	initWebSocketHub()

	// Sync all challenges from MinIO on startup
	debug.Println("INFO: Launching initial challenge sync goroutine...")
	go func() {
		ctx := context.Background()
		if err := utils.SyncAllChallengesFromMinIO(ctx); err != nil {
			debug.Log("Warning: Initial challenge sync failed: %v", err)
		} else {
			debug.Println("INFO: Initial challenge sync goroutine completed successfully")
		}
	}()

	// Start hint activation scheduler
	utils.StartHintScheduler()

	router := gin.Default()

	sessionSecret := os.Getenv("SESSION_SECRET")
	if sessionSecret == "" {
		sessionSecret, _ = generateRandomString(25)
	}
	store := cookie.NewStore([]byte(sessionSecret))
	store.Options(sessions.Options{
		Path:     "/",
		MaxAge:   60 * 60 * 24,
		HttpOnly: true,
		Secure:   true,
		SameSite: http.SameSiteLaxMode,
	})
	router.Use(sessions.Sessions("pwnthemall", store))
	router.SetTrustedProxies([]string{"172.70.1.0/24"})
	router.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"https://pwnthemall.local", "https://demo.pwnthemall.com"},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
	}))

	router.GET("/ping", func(c *gin.Context) {
		c.JSON(200, gin.H{"message": "pong"})
	})

	routes.RegisterUserRoutes(router)
	routes.RegisterAuthRoutes(router)
	routes.RegisterWebhookRoutes(router)
	routes.RegisterChallengeRoutes(router)
	routes.RegisterChallengeCategoryRoutes(router)
	routes.RegisterTeamRoutes(router)
	routes.RegisterConfigRoutes(router)
	routes.RegisterDockerConfigRoutes(router)
	routes.RegisterInstanceRoutes(router)
	routes.RegisterNotificationRoutes(router)
	routes.RegisterDecayFormulaRoutes(router)
	routes.RegisterSubmissionRoutes(router)
	routes.RegisterDashboardRoutes(router)

	if os.Getenv("PTA_PLUGINS_ENABLED") == "true" {
		debug.Log("Loading plugins...")
		pluginsystem.LoadAllPlugins("/app/plugins/bin", router, config.CEF)
		routes.RegisterPluginRoutes(router)
		defer pluginsystem.ShutdownAllPlugins()
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	debug.Log("Starting server on port %s", port)
	debug.Log("Server starting on port %s", port)
	router.Run(":" + port)
}
