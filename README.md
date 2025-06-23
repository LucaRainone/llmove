# llmove

`llmove` is a command-line tool that processes XML specification files and sends them to Claude (Anthropic's LLM) for AI-powered code generation.

## What it does

`llmove` scans a directory of `.xml` specification files, extracts prompts and system instructions, and sends them to Claude to generate code or documentation. The tool:

- Recursively processes XML files with support for includes and plugins
- Tracks which files have been processed to avoid duplicates
- Supports dry-run mode to preview what will be sent to the API
- Can re-apply the last generated output
- Automatically handles file naming conflicts with timestamps

## Installation

```bash
npm install -g llmove
```

## Quick Start

### 1. Configure llmove

```bash
llmove configure
```

This will prompt you for:
- Your Anthropic API key
- The model to use (default: `claude-opus-4-20250514`)
- The specs folder path (default: `specs`)

Configuration is stored in `~/.llmove/config.json`.

### 1.1 Initialize llmove in your project

```bash
llmove init
```

### 2. Write your first spec file

Create a file `specs/my-feature.xml`:

```xml
<prompt>
  Generate a Node.js function that validates email addresses using regex.
  The function should:
  - Return true for valid emails
  - Return false for invalid emails
  - Handle edge cases like multiple dots, special characters
</prompt>
```

### 3. Run llmove

```bash
# Preview what will be sent (dry run)
llmove --dryRun

# Generate code from your specs
llmove

```

## Writing XML Spec Files

### Basic Structure

Spec files use two main tags:

- `<system>` - Sets the system prompt/context for the LLM
- `<prompt>` - Contains the user prompt/request

### Example Spec File

```xml
<!-- specs/api/user-service.xml -->
<system>
  You are an expert Node.js developer. Generate clean, well-documented code
  following REST API best practices.
</system>

<prompt>
  Create a user service with the following endpoints:
  - GET /users - List all users with pagination
  - GET /users/:id - Get user by ID
  - POST /users - Create new user
  - PUT /users/:id - Update user
  - DELETE /users/:id - Delete user
  
  Use Express.js and include input validation.
</prompt>
```

### Advanced Features

#### Including Files

You can include content from other files:

```xml
<prompt>
  Update this function to handle async operations:
  
  <llmove:include path="./src/validator.js" lines="10:25" />
</prompt>
```

#### Source Code References

Use the source tag to include entire files:

```xml
<prompt>
  Refactor this code to use TypeScript:
  
  <llmove:source path="./legacy/user.js" />
</prompt>
```

#### Root Configuration

The `specs/root.xml` file can define global settings:

```xml
<system version="1.0">
  <!-- Global system context applied to all prompts -->
  You are a senior developer working on a Node.js microservices project.
  Follow clean code principles and include comprehensive error handling.
</system>
```

## Configuration

### Environment Variables

You can override configuration using environment variables:

- `LLMOVE_API_KEY` - Your Anthropic API key
- `LLMOVE_API_URL` - Custom API URL (default: https://api.anthropic.com)
- `LLMOVE_API_MODEL` - Model to use

### File Structure

```
project/
├── specs/              # Your XML specification files
│   ├── root.xml       # Global configuration
│   └── features/      # Organize specs in subdirectories
├── .llmove/           # Cache and metadata
│   ├── userPrompts.txt        # Tracks processed files
│   └── last-llmove-output.json # Last generation result
```

## Tips

1. **Organize your specs**: Use subdirectories to group related specifications
2. **Use conventions.xml**: Place common patterns in `conventions.xml` files
3. **Incremental processing**: llmove tracks which files have been processed
4. **Version control**: Commit your specs to track changes over time
5. **Dry run first**: Always use `--dryRun` to preview before making API calls

---

## How to Contribute

### Architecture

`llmove` is designed to be minimal and extensible:

- **Main CLI** (`llmove.cjs`): Entry point and command handling
- **Libraries** (`lib/`): Core functionality split into focused modules
- **Plugins** (`lib/plugins/`): Transform and filter XML content

### Plugin System

llmove supports two types of plugins:

#### Filter Plugins

Filter plugins process the list of files before parsing:

```javascript
// lib/plugins/myFilter.js
module.exports = async function filterExample(config, files, metadata) {
  // Transform or filter the files array
  return files.filter(file => !file.path.includes('draft'));
};
```

#### Parse Plugins

Parse plugins transform individual file content:

```javascript
// lib/plugins/myParser.js
module.exports = async function parseExample(config, file, metadata) {
  // Transform file content
  file.content = file.content.replace(/TODO/g, 'TASK');
  
  // Can return just the file or include new files to process
  return {
    file: file,
    newFiles: [] // Optional: additional files to process
  };
};
```

### Adding Plugins

1. Create your plugin in `lib/plugins/`
2. Add it to the appropriate array in `lib/plugins.js`:

```javascript
const filterPlugins = [
  require('./plugins/filterAddRootConventions'),
  require('./plugins/myFilter') // Add your filter plugin
];

const parsePlugins = [
  require('./plugins/source'),
  require('./plugins/includeFiles'),
  require('./plugins/myParser') // Add your parse plugin
];
```

### Core Modules

- **api.js**: Handles communication with Anthropic's API
- **config.js**: Manages configuration from file and environment
- **files.js**: File system operations and XML file discovery
- **parser.js**: XML parsing and content extraction
- **output.js**: File writing with conflict resolution
- **plugins.js**: Plugin system orchestration
- **init.js**: Interactive configuration setup

### Development Guidelines

1. **Keep it tiny**: No unnecessary dependencies
2. **Small functions**: Each function should do one thing well
3. **Clear separation**: Logic should be separated into appropriate modules
4. **Error handling**: Fail gracefully with helpful error messages
5. **Cross-platform**: Use Node.js built-ins for file system operations
6. **Autocode**: Use llmove itself to create plugins =)

### Testing

Create test XML files in `specs/test/` and run:

```bash
llmove --dryRun
```

### Submitting Changes

1. Fork the repository
2. Create a feature branch
3. Write clear commit messages
4. Ensure your code follows the existing style
5. Submit a pull request with a description of your changes

## License

CC0-1.0 

## Author

Luca Rainone
