/*
 Navicat Premium Data Transfer

 Source Server         : local
 Source Server Type    : MySQL
 Source Server Version : 80300 (8.3.0)
 Source Host           : localhost:3306
 Source Schema         : heart

 Target Server Type    : MySQL
 Target Server Version : 80300 (8.3.0)
 File Encoding         : 65001

 Date: 05/03/2026 20:50:23
*/

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ----------------------------
-- Table structure for psych_answers
-- ----------------------------
DROP TABLE IF EXISTS `psych_answers`;
CREATE TABLE `psych_answers` (
  `test_id` bigint NOT NULL,
  `item_id` varchar(16) NOT NULL,
  `answer` tinyint unsigned NOT NULL,
  `score` tinyint unsigned NOT NULL,
  `answered_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`test_id`,`item_id`),
  KEY `idx_test` (`test_id`),
  KEY `idx_item` (`item_id`),
  CONSTRAINT `fk_ans_item` FOREIGN KEY (`item_id`) REFERENCES `psych_items` (`id`),
  CONSTRAINT `fk_ans_test` FOREIGN KEY (`test_id`) REFERENCES `psych_tests` (`test_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ----------------------------
-- Table structure for psych_items
-- ----------------------------
DROP TABLE IF EXISTS `psych_items`;
CREATE TABLE `psych_items` (
  `id` varchar(16) NOT NULL,
  `type` varchar(10) DEFAULT NULL,
  `question` text NOT NULL,
  `domain` varchar(32) NOT NULL,
  `facet` varchar(64) NOT NULL,
  `reverse_scored` tinyint(1) NOT NULL DEFAULT '0',
  `options_json` json DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_items_domain_active` (`domain`),
  KEY `idx_items_facet_active` (`facet`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ----------------------------
-- Table structure for psych_results
-- ----------------------------
DROP TABLE IF EXISTS `psych_results`;
CREATE TABLE `psych_results` (
  `test_id` bigint NOT NULL,
  `risk_level` enum('R0','R1','R2','R3') NOT NULL,
  `risk_score` decimal(6,4) NOT NULL,
  `domains_json` json NOT NULL,
  `tags_json` json NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`test_id`),
  CONSTRAINT `fk_res_test` FOREIGN KEY (`test_id`) REFERENCES `psych_tests` (`test_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Table structure for psych_tests
-- ----------------------------
DROP TABLE IF EXISTS `psych_tests`;
CREATE TABLE `psych_tests` (
  `test_id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` bigint NOT NULL,
  `version` varchar(64) NOT NULL,
  `started_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `finished_at` timestamp NULL DEFAULT NULL,
  `status` enum('in_progress','finished') NOT NULL DEFAULT 'in_progress',
  PRIMARY KEY (`test_id`),
  KEY `idx_user_status` (`user_id`,`status`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ----------------------------
-- Table structure for psych_users
-- ----------------------------
DROP TABLE IF EXISTS `psych_users`;
CREATE TABLE `psych_users` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `username` varchar(64) NOT NULL,
  `password` varchar(255) NOT NULL,
  `role` enum('student','teacher','bureau') NOT NULL,
  `school_id` bigint NOT NULL,
  `real_name` varchar(64) DEFAULT NULL,
  `grade` int DEFAULT NULL,
  `class_no` int DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`),
  KEY `idx_school_role` (`school_id`,`role`),
  KEY `idx_school_grade_class` (`school_id`,`grade`,`class_no`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ----------------------------
-- Table structure for scale_options
-- ----------------------------
DROP TABLE IF EXISTS `scale_options`;
CREATE TABLE `scale_options` (
  `type` varchar(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `scale_name` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `time_window` varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `min_score` int NOT NULL,
  `max_score` int NOT NULL,
  `options_json` json NOT NULL,
  PRIMARY KEY (`type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

SET FOREIGN_KEY_CHECKS = 1;
