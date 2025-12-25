package routes

import (
	"github.com/gin-gonic/gin"
	"github.com/pwnthemall/pwnthemall/backend/controllers"
	"github.com/pwnthemall/pwnthemall/backend/middleware"
)

func RegisterPageRoutes(router *gin.Engine) {
	// Admin routes for page management
	adminPages := router.Group("/admin/pages", middleware.AuthRequired(false))
	{
		adminPages.GET("", middleware.CheckPolicy("/admin/pages", "read"), middleware.RateLimit(60), controllers.GetPages)
		adminPages.GET("/:id", middleware.CheckPolicy("/admin/pages/:id", "read"), middleware.RateLimit(60), controllers.GetPage)
		adminPages.POST("", middleware.CheckPolicy("/admin/pages", "write"), middleware.RateLimit(10), controllers.CreatePage)
		adminPages.PUT("/:id", middleware.CheckPolicy("/admin/pages/:id", "write"), middleware.RateLimit(30), controllers.UpdatePage)
		adminPages.DELETE("/:id", middleware.CheckPolicy("/admin/pages/:id", "write"), middleware.RateLimit(10), controllers.DeletePage)
	}

	// API route for serving custom pages as JSON (used by Next.js SSR)
	apiPages := router.Group("/api/pages")
	{
		apiPages.GET("/:slug", middleware.RateLimit(120), controllers.ServePublicPageAPI)
	}

	// Public route for serving custom pages as HTML (optional direct access)
	publicPages := router.Group("/pages")
	{
		publicPages.GET("/:slug", middleware.RateLimit(120), controllers.ServePublicPage)
	}
}
