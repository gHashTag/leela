#!/usr/bin/ruby
# Put the built board into the app bundle, as a folder rather than as files.
#
# The game is the board. Fetching it from a web server made the whole app
# depend on one being up, and during development that server was a developer's
# laptop on a home network - `http://192.168.1.102:4173` - which is what every
# shipped copy would have tried to reach.
#
# A *folder reference* (blue in Xcode), not a group: the build keeps the
# directory as-is, so `board/assets/index-….js` lands at that path inside
# `leela.app` and `index.html` finds it by the relative paths Vite now writes.
# Added as a group, Xcode would flatten every file into the bundle root and the
# page would load with no styles and no script.
#
# Idempotent: re-run it after every `vite build` + copy.

require 'xcodeproj'

project_path = File.join(__dir__, 'leela.xcodeproj')
project = Xcodeproj::Project.open(project_path)

target = project.targets.find { |t| t.name == 'leela' }
abort 'target leela not found' unless target

group = project.main_group['leela'] || project.main_group

# Drop any previous reference, so re-running does not add a second one.
existing = group.files.select { |f| f.path == 'board' }
existing.each do |ref|
  target.resources_build_phase.files.select { |bf| bf.file_ref == ref }.each do |bf|
    target.resources_build_phase.remove_build_file(bf)
  end
  ref.remove_from_project
end

ref = group.new_reference('board')
ref.last_known_file_type = 'folder'
ref.name = 'board'

target.resources_build_phase.add_file_reference(ref)
project.save

puts "board added as a folder reference to target leela"
