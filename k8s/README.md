# Kubernetes Deployment Guide

Learn Kubernetes by deploying the ADS Painel project locally.

## Prerequisites

```bash
# Install minikube (local Kubernetes cluster)
curl -LO https://github.com/kubernetes/minikube/releases/latest/download/minikube-linux-amd64
sudo install minikube-linux-amd64 /usr/local/bin/minikube

# Install kubectl (Kubernetes CLI)
curl -LO https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl
sudo install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl

# Install k9s (Kubernetes TUI)
sudo install -o root -g root -m 0755 /usr/local/bin/k9s /usr/local/bin/k9s
```

## Quick Start

### 1. Start local Kubernetes cluster
```bash
minikube start --cpus=4 --memory=4096
minikube dashboard  # Optional: web UI
```

### 2. Build Docker image
```bash
cd /home/hugo/projects/ads-painel
docker build -t ads-painel:latest .

# Load image into minikube
minikube image load ads-painel:latest
```

### 3. Set up secrets
```bash
cd k8s
cat > .secret.env << 'EOF'
OPENCODE_API_KEY=your_key_here
WHATSAPP_GROUP_ID_ALUNOS=group_id_1
WHATSAPP_GROUP_ID_PROFS=group_id_2
EOF
```

### 4. Deploy to Kubernetes
```bash
# Create namespace
kubectl create namespace ads-painel

# Apply Kustomize manifests
kubectl apply -k . -n ads-painel

# Wait for pods to start
kubectl get pods -n ads-painel -w
```

### 5. Access the app
```bash
# Port forward to service
kubectl port-forward -n ads-painel svc/web 3000:3000

# Access in browser
# http://localhost:3000
```

### 6. Explore with k9s
```bash
k9s -n ads-painel
```

**Inside k9s:**
- `:po` - View pods
- `l` - View logs
- `e` - Shell into container
- `d` - Delete resource
- `/` - Search
- `?` - Help

## Architecture

### Deployments
- **web**: Express server + OpenUI frontend (port 3000)
- **bot**: WhatsApp listener (uses shared SQLite database)

### Storage
- **PVC (ads-painel-data)**: Persistent SQLite database shared between web and bot

### Config
- **ConfigMap**: Public config (OPENCODE_BASE_URL, OPENCODE_MODEL, DB_PATH)
- **Secret**: Sensitive data (API keys, group IDs) from `.secret.env`

## Common Tasks

### View pod logs
```bash
kubectl logs -n ads-painel deployment/web -f
kubectl logs -n ads-painel deployment/bot -f
```

### Shell into pod
```bash
kubectl exec -it -n ads-painel deployment/web -- /bin/sh
```

### Restart deployment
```bash
kubectl rollout restart deployment/web -n ads-painel
```

### Scale replicas
```bash
kubectl scale deployment/web --replicas=3 -n ads-painel
```

### Delete everything
```bash
kubectl delete namespace ads-painel
```

## Learning Resources

- [Kubernetes Concepts](https://kubernetes.io/docs/concepts/)
- [kubectl Cheat Sheet](https://kubernetes.io/docs/reference/kubectl/cheatsheet/)
- [k9s Wiki](https://github.com/derailed/k9s/wiki)

## Next Steps

1. **Persistent Storage**: Understand PVCs and StatefulSets
2. **ConfigMaps & Secrets**: Learn config management patterns
3. **Networking**: Explore Services (ClusterIP vs NodePort vs LoadBalancer)
4. **Ingress**: Add HTTP routing with Ingress controller
5. **Monitoring**: Add Prometheus/Grafana for observability
6. **CI/CD**: Automate deployments with GitHub Actions + ArgoCD
