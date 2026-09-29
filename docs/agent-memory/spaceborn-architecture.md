# Spaceborn E-Commerce AWS Architecture

This document outlines the planned AWS infrastructure based on our recent Terraform updates, isolating backend services for maximum security while keeping public-facing components accessible.

## Architecture Diagram

```mermaid
flowchart TD
    Internet((Internet))

    subgraph VPC ["AWS VPC (Virtual Private Cloud)"]
        direction TB
        
        IGW[Internet Gateway]
        Internet <--> IGW

        subgraph PublicSubnet ["Public Subnet (10.0.1.0/24)"]
            direction TB
            ALB[Reverse Proxy / ALB\n(Entry for Users)]
            NAT[NAT Gateway\n(Outbound Internet for Private Apps)]
            Bastion[Bastion Host\n(Secure SSH Access)]
        end
        
        IGW <--> ALB
        IGW <--> Bastion
        IGW <--> NAT

        subgraph PrivateSubnet ["Private Subnet (10.0.2.0/24 & 10.0.3.0/24)"]
            direction TB
            
            subgraph Apps ["Next.js Applications (EC2 / ECS)"]
                CS[Customer Storefront]
                VH[Vendor Hub]
                AP[Admin Panel]
            end
            
            subgraph Workers ["Background Workers"]
                Celery[Celery Worker]
            end
            
            subgraph MessageBrokers ["Message Brokers (ECS Fargate)"]
                RabbitMQ[(RabbitMQ)]
                Redis[(Redis Cache)]
            end
            
            subgraph Database ["Data Tier"]
                RDS[(RDS PostgreSQL\nReplaces Supabase)]
            end
        end
        
        %% Traffic flows
        ALB --> CS
        ALB --> VH
        ALB --> AP
        
        CS --> RDS
        VH --> RDS
        AP --> RDS
        
        CS --> Redis
        AP --> Celery
        Celery <--> RabbitMQ
        Celery --> RDS
        
        %% Outbound traffic routing
        Apps -.-> |Outbound API calls\ne.g. Razorpay| NAT
        Workers -.-> |Outbound| NAT
        
        %% Admin access
        Bastion -.-> |SSH/Admin| Apps
        Bastion -.-> |DB Mgmt| Database
    end
```

### Key Security Features
1. **Complete Isolation:** The RDS Database and Next.js applications have NO public IP addresses. They cannot be directly reached from the internet, protecting you from direct attacks.
2. **Controlled Ingress:** All user traffic must pass through the Reverse Proxy/ALB in the public subnet, which acts as a shield.
3. **Controlled Egress:** When your private apps need to talk to the outside world (like verifying a Razorpay transaction), the traffic securely routes out through the NAT Gateway.
4. **AWS Native Database:** Supabase has been entirely replaced by an AWS-managed RDS PostgreSQL instance inside your private network, meaning data never traverses the open internet.
