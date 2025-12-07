package controllers

import (
	"github.com/gin-gonic/gin"
	"github.com/jinzhu/copier"
	"github.com/pwnthemall/pwnthemall/backend/config"
	"github.com/pwnthemall/pwnthemall/backend/debug"
	"github.com/pwnthemall/pwnthemall/backend/dto"
	"github.com/pwnthemall/pwnthemall/backend/models"
	"github.com/pwnthemall/pwnthemall/backend/utils"
)

func GetInstances(c *gin.Context) {
	var instances []models.Instance
	result := config.DB.Preload("User").Preload("Team").Preload("Challenge").Find(&instances)
	if result.Error != nil {
		utils.InternalServerError(c, result.Error.Error())
		return
	}

	var instanceDTOs []dto.InstanceDTO
	for _, instance := range instances {
		var instanceDTO dto.InstanceDTO
		copier.Copy(&instanceDTO, &instance)
		instanceDTOs = append(instanceDTOs, instanceDTO)
	}

	utils.OKResponse(c, instanceDTOs)
}

func GetInstance(c *gin.Context) {
	var instance models.Instance
	id := c.Param("id")
	result := config.DB.Preload("User").Preload("Team").Preload("Challenge").First(&instance, id)
	if result.Error != nil {
		utils.NotFoundError(c, "Instance not found")
		return
	}

	var instanceDTO dto.InstanceDTO
	copier.Copy(&instanceDTO, &instance)

	utils.OKResponse(c, instanceDTO)
}

// GetAllInstancesAdmin returns all instances with full details for admin dashboard
func GetAllInstancesAdmin(c *gin.Context) {
	var instances []models.Instance
	result := config.DB.
		Preload("User").
		Preload("Team").
		Preload("Challenge").
		Preload("Challenge.ChallengeCategory").
		Order("created_at DESC").
		Find(&instances)

	if result.Error != nil {
		utils.InternalServerError(c, result.Error.Error())
		return
	}

	var instanceDTOs []dto.AdminInstanceDTO
	for _, instance := range instances {
		var instanceDTO dto.AdminInstanceDTO
		copier.Copy(&instanceDTO, &instance)
		
		// Manually set nested fields that copier can't automatically map
		instanceDTO.Username = instance.User.Username
		instanceDTO.TeamName = instance.Team.Name
		instanceDTO.ChallengeName = instance.Challenge.Name
		
		if instance.Challenge.ChallengeCategory != nil {
			instanceDTO.Category = instance.Challenge.ChallengeCategory.Name
		}

		instanceDTOs = append(instanceDTOs, instanceDTO)
	}

	utils.OKResponse(c, instanceDTOs)
}

// DeleteInstanceAdmin allows admins to stop/delete any instance
func DeleteInstanceAdmin(c *gin.Context) {
	id := c.Param("id")
	var instance models.Instance

	result := config.DB.Preload("Challenge").Preload("Challenge.ChallengeType").First(&instance, id)
	if result.Error != nil {
		utils.NotFoundError(c, "Instance not found")
		return
	}

	// Delete the instance from database first
	if err := config.DB.Delete(&instance).Error; err != nil {
		utils.InternalServerError(c, err.Error())
		return
	}

	// Stop the Docker/Compose container asynchronously (can take time)
	if instance.Name != "" {
		containerName := instance.Name
		isCompose := instance.Challenge.ChallengeType.Name == "compose"

		go func() {
			if isCompose {
				debug.Log("Admin stopping Compose project asynchronously: %s", containerName)
				if err := utils.StopComposeInstance(containerName); err != nil {
					debug.Log("Warning: Error stopping Compose instance (may already be stopped): %v", err)
				} else {
					debug.Log("Compose project stopped successfully: %s", containerName)
				}
			} else {
				debug.Log("Admin stopping Docker container asynchronously: %s", containerName)
				if err := utils.StopDockerInstance(containerName); err != nil {
					debug.Log("Warning: Error stopping Docker instance (may already be stopped): %v", err)
				} else {
					debug.Log("Docker container stopped successfully: %s", containerName)
				}
			}
		}()
	}

	utils.OKResponse(c, gin.H{"message": "Instance deleted successfully"})
}

// StopAllInstancesAdmin allows admins to stop all running instances
func StopAllInstancesAdmin(c *gin.Context) {
	var instances []models.Instance

	result := config.DB.Preload("Challenge").Preload("Challenge.ChallengeType").Find(&instances)
	if result.Error != nil {
		utils.InternalServerError(c, result.Error.Error())
		return
	}

	if len(instances) == 0 {
		utils.OKResponse(c, gin.H{
			"message": "No instances to stop",
			"count":   0,
		})
		return
	}

	// Delete all instances from database first
	if err := config.DB.Delete(&instances).Error; err != nil {
		utils.InternalServerError(c, err.Error())
		return
	}

	count := len(instances)
	debug.Log("Admin stopping all instances: %d total", count)

	// Stop all Docker/Compose containers asynchronously with rate limiting (3 at a time)
	const maxConcurrent = 3
	semaphore := make(chan struct{}, maxConcurrent)

	for _, instance := range instances {
		if instance.Name != "" {
			containerName := instance.Name
			isCompose := instance.Challenge.ChallengeType != nil && instance.Challenge.ChallengeType.Name == "compose"

			// Acquire semaphore slot (blocks if 3 are already running)
			semaphore <- struct{}{}

			go func(name string, compose bool) {
				defer func() { <-semaphore }() // Release semaphore slot when done

				if compose {
					debug.Log("Admin stopping Compose project asynchronously: %s", name)
					if err := utils.StopComposeInstance(name); err != nil {
						debug.Log("Warning: Error stopping Compose instance (may already be stopped): %v", err)
					} else {
						debug.Log("Compose project stopped successfully: %s", name)
					}
				} else {
					debug.Log("Admin stopping Docker container asynchronously: %s", name)
					if err := utils.StopDockerInstance(name); err != nil {
						debug.Log("Warning: Error stopping Docker instance (may already be stopped): %v", err)
					} else {
						debug.Log("Docker container stopped successfully: %s", name)
					}
				}
			}(containerName, isCompose)
		}
	}

	utils.OKResponse(c, gin.H{
		"message": "All instances stopped successfully",
		"count":   count,
	})
}
