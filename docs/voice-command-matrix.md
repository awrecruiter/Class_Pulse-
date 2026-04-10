# Voice Command Matrix

This is the current app-wide voice surface inventory. The goal is for every major teacher action to be reachable through the shared voice layer.

## Surfaces

| Surface | Route | Current Voice Coverage | Status |
|---|---|---|---|
| Coach | `/coach` | session control, lecture control, behavior actions, RAM Bucks, move group, parent message, schedule, docs, ask coach, show DI groups | Implemented / primary surface |
| Board | `/board` | open apps, switch panels, reopen last resource | Implemented |
| Classes | `/classes` | navigation, create class, open class | Implemented |
| Class Detail | `/classes/[id]` | inherits global navigation only | Partial |
| Gradebook | `/gradebook` | navigation, export gradebook | Partial |
| Store | `/store` | open/close store via global commands, approve/reject purchase | Partial |
| Parent Comms | `/parent-comms` | navigation, parent-message routing from coach | Partial |
| Settings | `/settings` | navigation only | Partial |

## Shared Global Commands

- `go to coach`
- `go to classes`
- `go to board`
- `go to gradebook`
- `go to store`
- `go to settings`
- `go to parent comms`
- `show schedule`
- `show DI groups`
- `open <schedule doc>`

## Classes Commands

- `create class <name>`
- `open <class name>`

## Coach Commands

- `start session`
- `end session`
- `start lecture`
- `stop lecture`
- `give <student> a warning`
- `give <student> detention`
- `give <student> <amount> ram bucks`
- `take <amount> ram bucks from <student>`
- `move <student> to <group>`
- `show DI groups`
- `message <student>'s parent <message>`
- `ask coach <question>`

## Board Commands

- `open portal`
- `open outlook`
- `open onedrive`
- `open pinnacle`
- `open schoology`
- `open clever`
- `open iready`
- `open ixl`
- `open big ideas`
- `open mcgraw hill`
- `open class pulse`
- `open resource panel`
- `open my last file`

## Next Migration Targets

### Classes
- class-specific actions after navigation

### Gradebook
- `save gradebook`
- `set score for <student> to <score>`

### Store
- `grant <item> to <student>`

### Parent Comms
- broader route-independent execution model

### Settings
- explicit remote/mobile execution settings, additive only
