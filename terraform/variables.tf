variable "supabase_url" {
  type        = string
  description = "Supabase API URL"
  default     = "https://ybcsjishccovgtwsdzxf.supabase.co"
}

variable "supabase_anon_key" {
  type        = string
  description = "Supabase Anon Key"
  default     = ""
}

variable "firebase_api_key" {
  type        = string
  description = "Firebase Web API Key"
  default     = ""
}

variable "ecr_image_uri" {
  type        = string
  description = "The URI of the Docker image in ECR"
  default     = "placeholder-uri"
}

variable "ecr_celery_image_uri" {
  type        = string
  description = "The URI of the Celery Docker image in ECR"
  default     = "placeholder-uri"
}


variable "db_password" {
  type        = string
  description = "Password for the RDS instance"
  sensitive   = true
}
