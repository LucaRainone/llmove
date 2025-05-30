# LLMOVE CLI

`llmove` is a command-line tool for parsing and transforming XML-based specifications using a language model (Claude Opus by Anthropic). 
It recursively scans a directory of `.xml` spec files, extracts user prompt content, and calls a language model API to generate corresponding output files.

## WHY

I love LLMs for coding (the tool is called **L(LM)OVE**), and I find them extremely useful for everyday tasks.
However, I always run into issues when I fully delegate work to an external, opaque tool like Copilot or similar solutions:

* I don’t have control over the context being shared to generate the code correctly.
* I don’t know whether I’m exposing sensitive data, since the tool decides what to send to the LLM service.
* The generated output doesn’t follow my project’s conventions (even if those are outdated or non-standard, they still matter).

Because of this, I prefer interacting with an LLM directly—copying context in, pasting results out. But that’s inefficient.

So, I started using a simple CLI tool to automate this interaction. I’ve been improving it by using the tool itself.

You can see an example in [examples/llmove-itself](examples/llmove-itself).

## HOW

Just:

- download the [llmove.cjs](llmove.cjs) file
- create your xml files in `specs` directory and run it. 
- Configure your anthropic API_KEY in the env var.
- write your specs following the [examples](examples) as guide
- run `node llmove.cjs --dryRun` to see the content that the cli will send to the LLM

In order to work with env vars easily you can (one of):

- `export LLMOVE_API_KEY=your_api_key_here`
- create a .env file (see [.env.example](.env.example)) and call the CLI with `node --env-file=.env llmove.cjs`
- run `LLMOVE_API_KEY=.... node llmove.cjs`
- if you already use dotenv package in your project, just add the LLMOVE_* vars in your .env file in the root file

It is better to write one spec file at time (but you want your root.xml and conventions.xml).
The executed files are tracked in the .llmove directory so they are not tracked anymore (you can commit for keep track of
requirements, or you can delete them).

## Example

You want to start a project, or work with an existent one.
You first need to create the first prompt with universal conventions. You can copy and paste this and working on it:

specs/root.xml
```xml
<system>
    You are a code assistant. You will receive a list of XML stuffs. Some are instructions to keep
    in mind, others are commands to execute. You may receive multiple commands, each to be executed separately, maintaining the same
    relative path.
    <context>
        You're working on a new TODO APP platform powered with AI
    </context>
    <dependencies>
        <backend>Fastify, Typebox, fastify-jwt, postgrator for migrations </backend>
        <database>PostgreSQL 17, no ORM just pure query</database>
        <development>Docker compose for postgres</development>
    </dependencies>
    <paths>
        <path relative="server">All backend stuff</path>
        <path relative="server/database/migrations">All migrations in pure SQL. {YYYYMMDDHHMM}-summary.sql</path>
        <path relative="server/src/lib">All the utilities functions. One file for each function</path>
        <path relative="server/src/plugins">All fastify plugins</path>
        <path relative="server/src/routes">All routes. Use autoload</path>
    </paths>
    <behaviour>
        Write a clear, clean nodejs. Write small functions and separate the logic.
    </behaviour>
</system>

```

This is the first system prompt—very simple and straightforward. You can improve it later adding conventions and specifications.
Please note that there is no schema validation. All tags are used solely to write concise and functional instructions for the LLM. You can use as many tags as you like; this method is more efficient for instructing the LLM.
The CLI simply removes the first <system> tag.

Sometimes, you need to make additional conventions explicit—for example, for the database.

specs/server/database/conventions.xml
```xml
<database_conventions type="yaml">
database:
  engine: Postgres 17
  generateComments: true
  uuid: preferred
  compositeKeys: mandatory and primary on *_link and *_info tables
  output: pure SQL in server/database/migrations
  tableNames:
    singular: true
    languageTable: lang
    relationSuffix: _link
    localizedSuffix: _info
    user: acl
  standardColumnNames:
    id: for primary id if not _info and _link. Use integer in case of few records (like labels, lang), uuid otherwise.
    created_at: for keep track of creation time if needed
    updated_at: for keep track of updating time if needed
    sort_index: for rows priority
    "{fk_table}_id": for foreign keys columns
  additional: >
    Timestamps must be stored with timezone information

</database_conventions>
```

Again, there is no schema validation and here I used yaml because it's more concise and we can save some token.
You can use this as draft. 

root and conventions files are always included.

Now we are ready to work.

specs/server/database/migrations/20250530-init-structure.xml
```xml
<command>
  create an initial database structure:
  — for user management (login, register, password recovery)
  - main langs table with first data entries (italian, english, german)
  - every user can insert a point of interests (coordinates, description). The description should be in multiple languages.
</command>
```

The command tag is stripped out by the cli.
As you can see the requirements are generic, but thanks to the well-written conventions files the output will be good.

The anthropic service will generate the file .sql in `server/database/migrations/202505311200-init-structure.sql`

Now we can create the first fastify routes

```xml
<feat>
    Here is the database dll as context for you:
    <dll>
        <include path="../../../server/database/migrations/202505311200-initial-schema.sql" lines="18:29"/>
    </dll>
    Create the routes for user management (login, register, recovery)
</feat>

```

The `<include>` part is very useful for context controlling. I'm giving to the LLM only the create table part regarding the users.
Very efficient.
In this case only the `<feat>` tag is stripped out.


## Features

* Recursively parses `.xml` files from a `specs/` directory.
* Detects system files (`root.xml`, `conventions.xml`) and separates user prompts.
* Tracks already-processed files to avoid duplication.
* Calls a Claude Opus API endpoint to generate files based on user prompts and system context.
* Stores output files locally and prevents overwrites by renaming duplicates.
* Supports dry-run and repeat-last-operation modes.

---

## Usage

```bash
node node llmove.cjs [--dryRun] [--again]
```

### Flags

* `--dryRun`:
  Displays the system, context, and user prompt content that would be sent to the API. No API calls are made, and no files are written.

* `--again`:
  Re-runs the last API response and re-generates the output files from the cached result in `.llmove/last-llmove-output.json`.

---

## Directory Structure

* `specs/`: Input directory containing `.xml` specification files.
* `.llmove/`: Internal cache directory.

    * `userPrompts.txt`: Tracks previously processed files.
    * `last-llmove-output.json`: Stores last API output for reuse.

---

## How It Works

1. **Scan Phase**:

    * Recursively scans all `.xml` files in `specs/`.
    * Identifies system-level files (`root.xml`, `conventions.xml`) and their `include` dependencies.
    * Extracts content, removes tags like `<command>`, `<feat>`, and CDATA wrappers.

2. **Processing Phase**:

    * Builds `system`, `context`, and `user` prompt messages from cleaned file contents.
    * Skips user prompts that were already processed unless `--again` is used.

3. **Execution Phase**:

    * In dry-run mode: Prints cleaned system and prompt contents.
    * In normal mode:

        * Sends a structured request to the Anthropic Claude API.
        * Receives a list of files to be written (with paths and content).
        * Writes those files to disk, renaming if they already exist.
        * Saves the output in `.llmove/last-llmove-output.json`.

---

## API Interaction

Uses HTTPS to POST a request to Anthropic's Claude API. The request includes:

* `system`: Concatenated content from system files.
* `messages`: User prompts to be interpreted.
* `tools`: Describes expected output format (a list of files with `path` and `content`).
* `tool_choice`: Forces Claude to use the `file_generator` tool.

**Expected API response**: A list of file objects with path and content, which the CLI writes locally.

---

## Requirements

* Node.js v20+
* An `API_KEY` provided via the environment variable `LLMOVE_API_KEY`

```bash
export apiKey=your_api_key_here
```

---

## Example Workflow

```bash
# First run: Parse and call API
node node llmove.cjs

# Repeat previous transformation without re-calling API
node node llmove.cjs --again

# Debug what would be sent to the API
node node llmove.cjs --dryRun
```

---

## Notes

* All processed file paths are logged to `.llmove/userPrompts.txt` to prevent duplicate processing.
* If a file with the same name already exists in output, a timestamp is appended to avoid overwriting.
* Includes are recursively resolved, and files included by user prompts are promoted to system files.

---

## License

CC0 1.0 Universal
