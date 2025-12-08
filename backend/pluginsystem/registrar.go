package pluginsystem

import (
	"bytes"
	"io"
	
	"net/http"

	"github.com/casbin/casbin/v2"
	"github.com/gin-gonic/gin"
	"github.com/pwnthemall/pwnthemall/backend/debug"
	"github.com/pwnthemall/pwnthemall/backend/shared"
	"github.com/pwnthemall/pwnthemall/backend/utils"
)

type GinRouteRegistrar struct {
	router   *gin.Engine
	plugin   shared.Plugin
	enforcer *casbin.Enforcer
}

func NewGinRouteRegistrar(router *gin.Engine, plugin shared.Plugin, enforcer *casbin.Enforcer) *GinRouteRegistrar {
	return &GinRouteRegistrar{
		router:   router,
		plugin:   plugin,
		enforcer: enforcer,
	}
}

func (g *GinRouteRegistrar) RegisterRoute(method, path, handlerName string) {
	g.RegisterRouteWithMiddlewares(method, path, handlerName, "", []string{})
}

func (g *GinRouteRegistrar) RegisterRouteWithAuth(method, path, handlerName, requireRole string) {
	g.RegisterRouteWithMiddlewares(method, path, handlerName, requireRole, []string{})
}

func (g *GinRouteRegistrar) RegisterRouteWithMiddlewares(method, path, handlerName, requireRole string, middlewareNames []string) {
	var middlewares []gin.HandlerFunc

	if len(middlewareNames) > 0 {
		middlewares = append(middlewares, GetMiddlewares(middlewareNames)...)
	}

	if requireRole != "" {
		middlewares = append(middlewares, g.createAuthMiddleware(path, method, requireRole))
	}

	handler := g.createPluginHandler(handlerName)
	handlers := append(middlewares, handler)

	switch method {
	case "GET":
		g.router.GET(path, handlers...)
	case "POST":
		g.router.POST(path, handlers...)
	case "PUT":
		g.router.PUT(path, handlers...)
	case "DELETE":
		g.router.DELETE(path, handlers...)
	}

	if len(middlewareNames) > 0 {
		debug.Log("Registered route: %s %s (role: %s, middlewares: %v)", method, path, requireRole, middlewareNames)
	} else {
		debug.Log("Registered route: %s %s (role: %s, no extra middlewares)", method, path, requireRole)
	}
}

func (g *GinRouteRegistrar) createAuthMiddleware(path, method, requireRole string) gin.HandlerFunc {
	return func(c *gin.Context) {
		claims, errMsg := utils.GetClaimsFromCookie(c)
		if claims == nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": errMsg})
			return
		}

		role := claims.Role
		if role == "" {
			role = "anonymous"
		}

		action := "read"
		if method == "POST" || method == "PUT" || method == "DELETE" {
			action = "write"
		}

		if g.enforcer != nil {
			ok, err := g.enforcer.Enforce(role, path, action)
			if err != nil {
				debug.Log("Casbin error for plugin route %s: %v", path, err)
				c.AbortWithStatusJSON(500, gin.H{"error": "authorization error"})
				return
			}

			if !ok {
				c.AbortWithStatusJSON(403, gin.H{"error": "unauthorized: wrong permissions"})
				return
			}
		}

		c.Set("user_id", claims.UserID)
		c.Set("user_role", claims.Role)

		c.Next()
	}
}

func (g *GinRouteRegistrar) createPluginHandler(handlerName string) gin.HandlerFunc {
	return func(c *gin.Context) {
		body, _ := io.ReadAll(c.Request.Body)
		c.Request.Body = io.NopCloser(bytes.NewBuffer(body))

		requestData := shared.RequestData{
			Method:  c.Request.Method,
			Path:    c.Request.URL.Path,
			Headers: c.Request.Header,
			Body:    body,
			Query:   c.Request.URL.Query(),
		}

		if rpcPlugin, ok := g.plugin.(*shared.PluginRPC); ok {
			response, err := rpcPlugin.HandleRequest(handlerName, requestData)
			if err != nil {
				c.JSON(500, gin.H{"error": err.Error()})
				return
			}

			for key, value := range response.Headers {
				c.Header(key, value)
			}

			c.Data(response.StatusCode, "application/json", response.Body)
		}
	}
}
