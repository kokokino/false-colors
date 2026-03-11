# Adding Lips & Mouth Bag to a Tripo AI Model via Blender MCP

## Prompt Sequence for Claude Desktop + Blender MCP

Use these prompts in order through Claude Desktop (or Cursor/VS Code) with Blender MCP connected. Wait for each step to complete before moving to the next.

---

## Prerequisites

- Blender 3.6+ open with the MCP addon running
- Claude Desktop (or another MCP client) configured with the Blender MCP server
- Your Tripo AI model exported as `.glb` or `.fbx`

---

## Phase 1: Import & Inspect

### Prompt 1 — Import the model

> Import the GLB file at `[YOUR FILE PATH]` into the current scene. Clear any default objects first. Set the viewport to solid shading mode so I can see the geometry.

### Prompt 2 — Inspect the mesh

> Get the scene info for the imported model. I need to know: total vertex count, whether the mesh is triangulated or has quads, and whether there are any existing vertex groups. Also take a screenshot of the model from the front view, zoomed in on the face.

### Prompt 3 — Analyze face topology

> Run a Python script that does the following:
> 1. Switch to edit mode on the character mesh
> 2. Find the approximate mouth region by looking for vertices in the lower-center area of the face (between the nose and chin, roughly)
> 3. Report how many vertices are in that region, the average edge length, and whether there are any existing edge loops that follow the lip line
> 4. Switch back to object mode when done
>
> Print all findings to the console.

---

## Phase 2: Prepare the Mesh

### Prompt 4 — Remesh the face region (if needed)

> Only do this step if the previous analysis showed the face is heavily triangulated with no clear lip edge loops.
>
> Run a script that:
> 1. Selects only the face region of the mesh (vertices within a bounding box around the head)
> 2. Applies a localized Remesh modifier (voxel mode, resolution ~0.005) to just the face area
> 3. OR uses Blender's "Tris to Quads" operation on the selected face triangles with a reasonable angle threshold
>
> The goal is to get cleaner quad-based topology around where the mouth will be, without destroying the rest of the model.

### Prompt 5 — Define the lip edge loop

> Run a Python script that:
> 1. Enters edit mode
> 2. Uses the knife tool or manual vertex selection to create a closed edge loop where the mouth opening should be — an elliptical shape centered on the face, roughly where lips would be
> 3. The loop should have approximately 16-24 vertices for good deformation
> 4. Adds a second, slightly larger concentric edge loop around the first (this defines the outer lip boundary)
> 5. Take a screenshot so I can verify the placement
>
> If the model already has a painted texture suggesting where the lips are, use the UV coordinates and texture colors to guide placement.

---

## Phase 3: Create the Mouth Bag

### Prompt 6 — Extrude the mouth cavity

> Run a Python script that:
> 1. Enters edit mode
> 2. Selects the inner lip edge loop (the mouth opening)
> 3. Extrudes it inward (into the head, along the face normal direction) by about 2-3cm to create the mouth cavity
> 4. Scales down the extruded loop slightly at the back to create a natural tapering shape (like the inside of a mouth)
> 5. Closes off the back of the cavity by merging the back vertices or filling the face
> 6. Recalculates normals so the inside of the mouth renders correctly (normals should face inward into the cavity)
> 7. Take a screenshot from a 3/4 angle with the mouth area visible

### Prompt 7 — Add supporting geometry

> Run a Python script that:
> 1. Adds 2-3 additional edge loops inside the mouth bag for smoother deformation
> 2. Adds 2 edge loops on the outer face around the lips (these will help the lips deform cleanly when animated)
> 3. Ensures all new geometry is properly connected — no loose vertices, no non-manifold edges
> 4. Run a mesh cleanup: remove doubles (merge by distance, threshold 0.0001), recalculate normals
> 5. Report the final vertex count in the mouth region

---

## Phase 4: Separate Upper/Lower Lips

### Prompt 8 — Split lip geometry for animation

> Run a Python script that:
> 1. Creates two vertex groups: `upper_lip` and `lower_lip`
> 2. Assigns the vertices above the mouth center line to `upper_lip`
> 3. Assigns the vertices below the mouth center line to `lower_lip`
> 4. Vertices right at the corners of the mouth should be in BOTH groups with 0.5 weight (these are the blend zone)
> 5. Also create a `mouth_bag` vertex group containing all the interior cavity vertices
> 6. Print the vertex count in each group

---

## Phase 5: Shape Keys for Basic Mouth Animation

### Prompt 9 — Create basis shape key

> Run a Python script that:
> 1. Adds a Basis shape key to the mesh (this captures the current closed-mouth state)
> 2. Creates a shape key called `mouth_open` — move the lower lip vertices down and slightly back, upper lip vertices slightly up, and spread the mouth bag vertices to accommodate the opening. The jaw drop should be about 2-3cm.
> 3. Creates a shape key called `mouth_smile` — move the mouth corner vertices up and outward
> 4. Creates a shape key called `mouth_frown` — move the mouth corner vertices down slightly
> 5. Creates a shape key called `lips_pursed` — move all lip vertices inward toward the center of the mouth, making the opening smaller
>
> Keep all movements subtle and proportional to the face size.

### Prompt 10 — Test the shape keys

> For each shape key (`mouth_open`, `mouth_smile`, `mouth_frown`, `lips_pursed`):
> 1. Set its value to 1.0
> 2. Take a screenshot of the face
> 3. Reset its value to 0.0
>
> Show me all four screenshots so I can verify the deformations look reasonable.

---

## Phase 6: Basic Rig Setup (Optional)

### Prompt 11 — Add mouth bones

> Run a Python script that:
> 1. Creates a new armature (or adds to the existing one if the Tripo model came with a rig)
> 2. Adds bones:
>    - `jaw_bone` — positioned at the jaw hinge point, pivots to open the mouth
>    - `lip_upper` — control bone for the upper lip
>    - `lip_lower` — control bone for the lower lip, parented to jaw_bone
>    - `lip_corner_L` and `lip_corner_R` — control bones at each mouth corner
> 3. Parents the jaw_bone to the head bone (if one exists) or to the armature root
> 4. Sets up the bone hierarchy so the lower lip follows jaw movement

### Prompt 12 — Connect bones to shape keys with drivers

> Run a Python script that:
> 1. Adds a driver on the `mouth_open` shape key — driven by the jaw_bone's X rotation
> 2. Adds a driver on the `mouth_smile` shape key — driven by the lip_corner bones' Z position
> 3. Adds a driver on the `lips_pursed` shape key — driven by a custom property on the lip_upper bone
> 4. Test each driver by rotating/moving the control bones and confirm the shape keys activate
> 5. Reset everything to rest position when done

---

## Phase 7: Finalize & Export

### Prompt 13 — Clean up and assign materials

> Run a Python script that:
> 1. If the model has an existing material/texture, make sure the new mouth bag geometry is properly UV unwrapped and assigned to the same material
> 2. Optionally create a simple dark-red/pink material for the inside of the mouth and assign it to the mouth_bag vertex group faces
> 3. Smooth the normals on the face area (auto smooth, angle threshold 30°)
> 4. Take a final screenshot from the front

### Prompt 14 — Export

> Export the final model as GLB to `[YOUR OUTPUT PATH]`. Make sure to include:
> - The mesh with all shape keys
> - The armature with all bones
> - Materials and textures
> - Use the "Apply Modifiers" option

---

## Troubleshooting Tips

| Problem | Solution Prompt |
|---|---|
| Mouth bag is inside-out (black faces) | "Select all faces in the mouth_bag vertex group, flip their normals, and recalculate normals with consistency" |
| Lips clip through each other | "Adjust the mouth_open shape key — reduce the upper lip upward movement by 50% and add a slight forward offset to both lips" |
| Shape keys look asymmetric | "Mirror the left side of each shape key to the right side using Blender's topology mirror" |
| Tripo model has no clear face area | "Use the mesh's bounding box to estimate the head region — top 20% of the model height, front-facing vertices only" |
| Existing rig breaks after editing | "Re-parent the mesh to the armature with automatic weights, then manually fix the lip area weights" |

---

## Notes

- **Tripo AI models** often come as dense triangle meshes. The remesh step (Prompt 4) is critical for getting clean deformations.
- **If Tripo's auto-rig was applied**, the model may already have a skeleton. Prompt 11 should detect this and add mouth bones to the existing armature rather than creating a new one.
- **Shape key values** will likely need manual tweaking after the initial generation. Use Prompt 10 to review, then ask Claude to adjust specific movements.
- **For lip sync animation**, you'll eventually want viseme shape keys (AA, EE, OO, etc.) — these can be built on top of the basic shapes created here.
