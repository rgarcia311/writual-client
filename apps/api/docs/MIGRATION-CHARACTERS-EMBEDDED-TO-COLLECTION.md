# Migration: Embedded characters to Characters collection

Characters were moved from being embedded on the project document (`project.characters`) to a dedicated **Characters** collection, with projects storing only `project.characterOrder` (array of ObjectIds referencing Characters).

## For existing data (one-time migration)

If you have projects that still have the old `characters` array (embedded subdocuments), run a one-time migration:

1. For each project document where `characters` exists and has length > 0:
   - For each item in `project.characters`:
     - Insert a document into the **Characters** collection with:
       - `projectId`: the project’s `_id`
       - `imageUrl`: from the embedded character if present
       - `details`: the embedded character’s `details` array (or equivalent)
     - Collect the inserted character’s `_id`
   - Set `project.characterOrder` to the array of those `_id`s (same order as the original `characters` array)
   - Unset `project.characters`

2. Optionally add a schema version or flag so you can skip already-migrated projects.

Example (pseudo-code):

```js
const projects = await Projects.find({ characters: { $exists: true, $ne: [] } });
for (const project of projects) {
  const order = [];
  for (const emb of project.characters) {
    const created = await Characters.create({
      projectId: project._id,
      imageUrl: emb.imageUrl,
      details: emb.details ?? [],
    });
    order.push(created._id);
  }
  await Projects.updateOne(
    { _id: project._id },
    { $set: { characterOrder: order }, $unset: { characters: 1 } }
  );
}
```

After migration, new characters are created/updated/deleted only via CharacterService (and the web app’s character server actions).
