package controllers

import (
	"fmt"
	"net/http"
	"os"
	"path/filepath"

	"github.com/gin-gonic/gin"
	"github.com/pwnthemall/pwnthemall/backend/config"
	"github.com/pwnthemall/pwnthemall/backend/debug"
	"github.com/pwnthemall/pwnthemall/backend/models"
	"github.com/pwnthemall/pwnthemall/backend/shared"
	"github.com/pwnthemall/pwnthemall/backend/utils"
)

// StartChallengeInstance starts an instance for a challenge
func StartChallengeInstance(c *gin.Context) {
	id := c.Param("id")
	var challenge models.Challenge
	result := config.DB.Preload("ChallengeType").First(&challenge, id)

	if result.Error != nil {
		debug.Log("Challenge not found with ID %s: %v", id, result.Error)
		c.JSON(http.StatusNotFound, gin.H{"error": "challenge_not_found"})
		return
	}

	if !CheckChallengeDependancies(c, challenge) {
		utils.NotFoundError(c, "challenge_not_found")
		return
	}

	handler, ok := shared.GetChallengeHandler(challenge.GetType())
	if !ok {
		debug.Log("No handler registered for challenge type: %s", challenge.GetType())
		c.JSON(http.StatusBadRequest, gin.H{"error": "unsupported_challenge_type"})
		return
	}

	if err := handler.Start(c, &challenge); err != nil {
		debug.Log("Failed to start challenge: %v", err)
		// Error response already sent by handler
		return
	}
}

func StopChallengeInstance(c *gin.Context) {
	id := c.Param("id")
	var challenge models.Challenge
	result := config.DB.Preload("ChallengeType").First(&challenge, id)

	if result.Error != nil {
		debug.Log("Challenge not found with ID %s: %v", id, result.Error)
		c.JSON(http.StatusNotFound, gin.H{"error": "challenge_not_found"})
		return
	}

	if !CheckChallengeDependancies(c, challenge) {
		utils.NotFoundError(c, "challenge_not_found")
		return
	}

	handler, ok := shared.GetChallengeHandler(challenge.GetType())
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "unsupported_challenge_type"})
		return
	}

	if err := handler.Stop(c, &challenge); err != nil {
		// Error response already sent by handler
		return
	}
}

func GetInstanceStatus(c *gin.Context) {
	id := c.Param("id")
	var challenge models.Challenge
	result := config.DB.Preload("ChallengeType").First(&challenge, id)

	if result.Error != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "challenge_not_found"})
		return
	}

	handler, ok := shared.GetChallengeHandler(challenge.GetType())
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "unsupported_challenge_type"})
		return
	}

	if err := handler.GetStatus(c, &challenge); err != nil {
		// Error response already sent by handler
		return
	}
}

// BuildChallengeImage builds a Docker image for a challenge
func BuildChallengeImage(c *gin.Context) {
	var challenge models.Challenge
	id := c.Param("id")
	result := config.DB.Preload("ChallengeType").First(&challenge, id)
	if result.Error != nil {
		utils.NotFoundError(c, "challenge_not_found")
		return
	}
	if !CheckChallengeDependancies(c, challenge) {
		utils.NotFoundError(c, "challenge_not_found")
		return
	}
	// Check if challenge is of type docker
	if challenge.ChallengeType.Name != "docker" {
		utils.BadRequestError(c, "challenge_not_docker_type")
		return
	}

	// Download the challenge context to a temporary directory
	tmpDir := filepath.Join(os.TempDir(), challenge.Slug)
	defer os.RemoveAll(tmpDir)

	if err := utils.DownloadChallengeContext(challenge.Slug, tmpDir); err != nil {
		utils.InternalServerError(c, fmt.Sprintf("Failed to download challenge context: %v", err))
		return
	}

	// Build the Docker image using the temporary directory as the source
	_, err := utils.BuildDockerImage(challenge.Slug, tmpDir)
	if err != nil {
		utils.InternalServerError(c, err.Error())
		return
	}

	utils.OKResponse(c, gin.H{"message": fmt.Sprintf("Successfully built image for challenge %s", challenge.Slug)})
}
