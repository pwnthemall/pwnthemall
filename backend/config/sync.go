package config

import (
	"os"

	"github.com/pwnthemall/pwnthemall/backend/debug"
	"github.com/pwnthemall/pwnthemall/backend/models"
)

func SynchronizeEnvWithDb() {
	// var configs []models.Config
	// if err := DB.Find(&configs).Error; err != nil {
	// 	log.Printf("Failed to load config from database: %v", err)
	// 	return
	// }

	// for _, cfg := range configs {
	// 	if !cfg.SyncWithEnv {
	// 		continue
	// 	}

	// 	if err := os.Setenv(cfg.Key, cfg.Value); err != nil {
	// 		log.Printf("Failed to set env variable %s: %v", cfg.Key, err)
	// 	} else {
	// 		log.Printf("Env variable set from DB: %s=%s", cfg.Key, cfg.Value)
	// 	}
	// }
	var dockerConfig models.DockerConfig
	if err := DB.Select("host").Find(&dockerConfig).Error; err != nil {
		debug.Log("Failed to retrieve host from docker config: %s", err.Error())
	} else {
		if err := os.Setenv("DOCKER_HOST", dockerConfig.Host); err != nil {
			debug.Log("Failed to set env variable DOCKER_HOST: %v", err)
		} else {
			debug.Log("Env variable set from DB: DOCKER_HOST=%s", dockerConfig.Host)
		}
	}

}
