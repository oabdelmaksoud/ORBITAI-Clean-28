# Weaviate Vector Database Setup Guide

## Overview

Weaviate is a production-grade vector database that provides:
- ✅ Persistent vector storage (not in-memory)
- ✅ Scalable to millions of artifacts
- ✅ Hybrid search (vector + keyword)
- ✅ Multi-tenant support
- ✅ Production-ready RAG system

---

## Quick Start

### Option 1: Docker Compose (Recommended)

The `docker-compose.yml` includes Weaviate. Just start it:

```bash
cd server
docker-compose up -d weaviate
```

Weaviate will be available at `http://localhost:8080`

### Option 2: Local Installation

```bash
# Install Docker first
# Then run Weaviate container
docker run -d \
  -p 8080:8080 \
  -p 50051:50051 \
  --name weaviate \
  -e QUERY_DEFAULTS_LIMIT=25 \
  -e AUTHENTICATION_ANONYMOUS_ACCESS_ENABLED=true \
  -e PERSISTENCE_DATA_PATH='/var/lib/weaviate' \
  -v weaviate_data:/var/lib/weaviate \
  semitechnologies/weaviate:latest
```

### Option 3: Weaviate Cloud (Managed)

1. Sign up at [Weaviate Cloud](https://console.weaviate.cloud/)
2. Create a cluster
3. Get connection URL and API key
4. Add to `.env`:
   ```env
   WEAVIATE_URL=https://your-cluster.weaviate.cloud
   WEAVIATE_API_KEY=your-api-key
   ```

---

## Configuration

### Environment Variables

Add to `server/.env`:

```env
# Weaviate Configuration
WEAVIATE_URL=http://localhost:8080
WEAVIATE_API_KEY=              # Optional for local, required for cloud
WEAVIATE_CLASS_NAME=OrbitAIArtifact

# Embedding Provider
EMBEDDING_PROVIDER=openai      # or 'gemini' (recommended: 'openai')
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
```

### Recommended: Use OpenAI Embeddings

For best quality, use OpenAI embeddings:

```env
EMBEDDING_PROVIDER=openai
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
OPENAI_API_KEY=your-openai-api-key
```

**Why OpenAI embeddings?**
- ✅ Higher quality semantic search
- ✅ Better RAG results
- ✅ Industry standard
- ✅ Cost-effective ($0.02 per 1M tokens)

---

## Migration from In-Memory

The system automatically:
1. Tries to connect to Weaviate on startup
2. Falls back to in-memory if Weaviate unavailable
3. Migrates artifacts when Weaviate becomes available

### Manual Migration

If you have existing artifacts in MongoDB:

```bash
# Migration happens automatically when vector search initializes
# Or trigger manually via API:

POST /api/mcp/vector-search/initialize
{
  "artifacts": [...]
}
```

---

## Verification

### Check Weaviate Status

```bash
curl http://localhost:8080/v1/meta
```

### Check Document Count

```bash
curl http://localhost:8080/v1/objects
```

### Test Vector Search

The system will automatically use Weaviate once connected. Check logs:

```
✅ Weaviate connected: http://localhost:8080
✅ Created Weaviate class: OrbitAIArtifact
✅ Using Weaviate for vector search
```

---

## Features Enabled

Once Weaviate is connected:

### 1. **Persistent Storage**
- Artifacts stored permanently
- Survives server restarts
- Scales to millions of documents

### 2. **Hybrid Search**
- Vector similarity + keyword search (BM25)
- Better recall and precision
- Configurable alpha (70% vector, 30% keyword default)

### 3. **Filtering**
- Filter by projectId, userId, type, phase
- Efficient indexed queries
- Combine with vector search

### 4. **Better Performance**
- HNSW index for fast similarity search
- Batch operations
- Optimized for production workloads

---

## Troubleshooting

### Weaviate Not Starting

```bash
# Check logs
docker logs weaviate

# Restart
docker restart weaviate
```

### Connection Failed

1. Check `WEAVIATE_URL` in `.env`
2. Verify Weaviate is running: `curl http://localhost:8080/v1/meta`
3. Check firewall/network settings

### Schema Creation Failed

Schema auto-creates on first use. If it fails:
- Check Weaviate logs
- Verify API key (if using cloud)
- Check network connectivity

### Fallback to In-Memory

If you see "Using in-memory vector search", check:
- Weaviate container is running
- `WEAVIATE_URL` is correct
- Network connectivity

---

## Production Deployment

### Docker Compose (Recommended)

```yaml
weaviate:
  image: semitechnologies/weaviate:latest
  ports:
    - "8080:8080"
  environment:
    - QUERY_DEFAULTS_LIMIT=25
    - AUTHENTICATION_ANONYMOUS_ACCESS_ENABLED=false  # Enable auth in prod
    - PERSISTENCE_DATA_PATH=/var/lib/weaviate
  volumes:
    - weaviate_data:/var/lib/weaviate
  restart: unless-stopped
```

### Kubernetes

See [Weaviate K8s docs](https://weaviate.io/developers/weaviate/installation/kubernetes)

### Managed Cloud

Use [Weaviate Cloud Services](https://console.weaviate.cloud/) for:
- Automatic scaling
- High availability
- Managed backups
- Security compliance

---

## Cost Considerations

### Self-Hosted (Free)
- Server costs only
- No per-query charges
- Full control

### Weaviate Cloud (Paid)
- ~$50-200/month for starter clusters
- Automatic scaling
- Managed service

### Embedding Costs
- OpenAI: ~$0.02 per 1M tokens
- Very cost-effective
- ~$1-5/month for typical usage

---

## Next Steps

1. ✅ Install Weaviate (Docker recommended)
2. ✅ Configure `.env` with `WEAVIATE_URL`
3. ✅ Optionally set `EMBEDDING_PROVIDER=openai` for better quality
4. ✅ Restart backend server
5. ✅ Check logs for "✅ Weaviate connected"

The system will automatically start using Weaviate for all vector operations!

---

## References

- [Weaviate Documentation](https://weaviate.io/developers/weaviate)
- [Weaviate TypeScript Client](https://weaviate.io/developers/weaviate/client-libraries/typescript)
- [OpenAI Embeddings](https://platform.openai.com/docs/guides/embeddings)

