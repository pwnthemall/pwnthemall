package shared

import "github.com/gin-gonic/gin"

type Challenge interface {
    GetID() uint
    GetSlug() string
    GetType() string
    GetPorts() []int64
    GetConnectionInfo() []string
}

type ChallengeHandler interface {
    Start(c *gin.Context, challenge Challenge) error
    Stop(c *gin.Context, challenge Challenge) error
    GetStatus(c *gin.Context, challenge Challenge) error
}
