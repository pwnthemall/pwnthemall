package routes

import (
	"github.com/gin-gonic/gin"
	"github.com/pwnthemall/pwnthemall/backend/controllers"
	"github.com/pwnthemall/pwnthemall/backend/middleware"
)

// RegisterTicketRoutes registers all ticket-related routes
func RegisterTicketRoutes(router *gin.Engine) {
	// User ticket endpoints
	tickets := router.Group("/tickets", middleware.TicketsEnabled, middleware.AuthRequired(false), middleware.CSRFProtection())
	{
		tickets.POST("", middleware.RateLimit(2), middleware.CheckPolicy("/tickets", "write"), controllers.CreateTicket)
		tickets.GET("", middleware.RateLimit(10), middleware.CheckPolicy("/tickets", "read"), controllers.GetUserTickets)
		tickets.GET("/:id", middleware.CheckPolicy("/tickets/:id", "read"), controllers.GetTicket)
		tickets.POST("/:id/messages", middleware.CheckPolicy("/tickets/:id/messages", "write"), controllers.SendTicketMessage)
		tickets.PUT("/:id/close", middleware.CheckPolicy("/tickets/:id/close", "write"), controllers.CloseTicket)
		tickets.POST("/upload", middleware.RateLimit(3), middleware.CheckPolicy("/tickets/upload", "write"), controllers.UploadTicketAttachment)
		tickets.GET("/:id/attachments/:filename", middleware.CheckPolicy("/tickets/:id", "read"), controllers.GetTicketAttachment)
	}

	// Admin ticket endpoints
	adminTickets := router.Group("/admin/tickets", middleware.TicketsEnabled, middleware.AuthRequired(false), middleware.CSRFProtection())
	{
		adminTickets.GET("", middleware.CheckPolicy("/admin/tickets", "read"), controllers.GetAllTickets)
		adminTickets.GET("/:id", middleware.CheckPolicy("/admin/tickets/:id", "read"), controllers.GetAdminTicket)
		adminTickets.PUT("/:id/resolve", middleware.CheckPolicy("/admin/tickets/:id/resolve", "write"), controllers.ResolveTicket)
		adminTickets.POST("/:id/messages", middleware.CheckPolicy("/admin/tickets/:id/messages", "write"), controllers.AdminReplyTicket)
		adminTickets.DELETE("/:id", middleware.CheckPolicy("/admin/tickets/:id", "write"), controllers.DeleteTicket)
	}
}
