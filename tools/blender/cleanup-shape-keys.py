import bpy

obj = bpy.context.active_object
keys = obj.data.shape_keys.key_blocks
to_remove = [k.name for k in keys if k.name != 'Basis' and not k.name.startswith('viseme_')]
for name in reversed(to_remove):
    idx = keys.find(name)
    obj.active_shape_key_index = idx
    bpy.ops.object.shape_key_remove()
print(f"Removed {len(to_remove)} shape keys. Remaining: {[k.name for k in obj.data.shape_keys.key_blocks]}")
