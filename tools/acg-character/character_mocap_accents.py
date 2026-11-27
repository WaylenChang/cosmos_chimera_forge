"""Sample selected ACCAD BVH joint trajectories for layered character performances."""
import json
import zipfile
from pathlib import Path
import numpy as np
from mathutils import Quaternion, Vector
from math import pi, radians, sin

class MotionReference:
    def __init__(self, directory, hero):
        group = 'Male1' if hero=='roen' else 'Female1'
        directory = Path(directory)
        self.actions = json.loads((directory/'accad_reference.json').read_text())[group]['actions']
        self.archive = zipfile.ZipFile(directory/(group+'.zip'))
        self.cache = {}
        self.window = {'roen':(.14,.70,.53),'amemori_sumiha':(.03,.58,.44),'yeh_chengxi':(.34,.95,.70)}[hero]

    def tracks(self, name):
        file = self.actions[name]['file']
        if file not in self.cache:
            hierarchy, motion = self.archive.read(file).decode('latin1').split('MOTION')
            start = 0
            columns = {}
            for line in hierarchy.splitlines():
                parts = line.split()
                if parts[:1] in (['JOINT'],['ROOT']):
                    joint = parts[1]
                if parts[:1]==['CHANNELS']:
                    columns[joint] = [(c[0],start+i) for i,c in enumerate(parts[2:]) if c.endswith('rotation')]
                    start += int(parts[1])
            values = np.loadtxt(motion.strip().splitlines()[2:]).reshape(-1,start)
            self.cache[file] = (columns,values)
        return self.cache[file]

    def delta(self, name, joint, t):
        columns, values = self.tracks(name)
        begin,end,gain = self.window
        def rotation(phase):
            row = min(len(values)-1,round(phase*(len(values)-1)))
            result = Quaternion()
            for axis,i in columns[joint]:
                # ACCAD Y-up to Blender Z-up.
                direction = {'X':(1,0,0),'Y':(0,0,1),'Z':(0,-1,0)}[axis]
                result = result @ Quaternion(direction,radians(values[row,i]))
            return result
        delta = rotation(begin).inverted() @ rotation(begin+(end-begin)*t)
        delta.make_compatible(Quaternion())
        return Quaternion(delta.axis,min(delta.angle,radians(36))*gain*sin(pi*t)**2)

