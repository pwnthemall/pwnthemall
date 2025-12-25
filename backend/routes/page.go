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
	
	// Public route for serving custom pages
	// This is a catch-all that will be checked before Next.js 404
	// Frontend should request /api/pages/:slug to get page content
	publicPages := router.Group("/pages")
	{
		publicPages.GET("/:slug", middleware.RateLimit(120), controllers.ServePublicPage)
	}
}
