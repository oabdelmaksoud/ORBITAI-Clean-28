# Game Mechanics Generation - Quick Start Guide

## What It Does

Generate production-ready game code from text descriptions in seconds.

**Supported Engines**: Unity, Godot, Phaser 3

## Quick Test

### 1. Start API
```bash
# Backend already running on port 3002
```

### 2. Test Unity Generation
```bash
curl -X POST http://localhost:3002/api/game-mechanics/generate \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "gameDescription": "2D platformer with combat",
    "targetEngine": "unity"
  }'
```

**Returns**: PlayerController.cs + CombatSystem.cs

### 3. Test Godot Generation
```bash
curl -X POST http://localhost:3002/api/game-mechanics/generate \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "gameDescription": "2D platformer",
    "targetEngine": "godot"
  }'
```

**Returns**: player_controller.gd

### 4. Test Phaser Generation
```bash
curl -X POST http://localhost:3002/api/game-mechanics/generate \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "gameDescription": "platformer game",
    "targetEngine": "phaser"
  }'
```

**Returns**: PlayerController.js

## Available Templates

| ID | Name | Engine | Features |
|----|------|--------|----------|
| unity-2d-movement | 2D Platformer Movement | Unity | Walk, Jump, Ground Detection |
| unity-combat-system | Combat System | Unity | Health, Damage, Death |
| godot-2d-movement | 2D Platformer Movement | Godot | Walk, Jump, Raycast |
| phaser-2d-movement | 2D Platformer Movement | Phaser | Walk, Jump, Web-based |

## Keywords Detection

The system detects these keywords:
- **"platformer"** → Generates movement code
- **"combat"/"fight"/"attack"** → Adds combat system
- **"enemies"** → Includes enemy detection

## Examples

**Simple Movement**:
```json
{
  "gameDescription": "2D platformer",
  "targetEngine": "unity"
}
// Result: PlayerController.cs only
```

**Movement + Combat**:
```json
{
  "gameDescription": "2D platformer with enemies and combat",
  "targetEngine": "unity"
}
// Result: PlayerController.cs + CombatSystem.cs
```

## Integration

### Add to Project Generation
See `docs/INTEGRATION.md` for details on auto-generating mechanics during project creation.

### Frontend UI
React component available at `client/src/services/gameMechanicsService.ts`

## Next Steps

1. **Test in Game Engine**: Copy generated code into Unity/Godot/Phaser project
2. **Customize**: Adjust variables in Inspector/editor
3. **Expand**: Add more templates for AI, progression, etc.

## Troubleshooting

**"No templates found"**: Check engine spelling (unity/godot/phaser)  
**"Auth error"**: Include valid JWT token in Authorization header  
**"Empty response"**: Check description includes keywords like "platformer"

## Status

✅ Phase 1: Foundation  
✅ Phase 2: Templates (4 total)  
🚧 Phase 3: LLM Customization (basic)  
🚧 Phase 4: Project Integration (hooks ready)  
✅ Phase 5: Documentation & Polish  

**Production Ready**: Yes, for basic use cases  
**Full LLM Integration**: Coming in future update
