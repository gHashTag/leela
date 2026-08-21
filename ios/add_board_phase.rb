#!/usr/bin/ruby
# Run the board sync before Xcode copies resources.
#
# Placed *first* in the target's phases, so `ios/board` is up to date by the
# time the folder reference is copied into the bundle. Placed last, it would
# update the directory after the copy and the app would ship the previous
# board — which is the exact failure this script exists to prevent.
#
# Idempotent: re-running replaces the phase rather than adding a second one.

require 'xcodeproj'

project_path = File.join(__dir__, 'leela.xcodeproj')
project = Xcodeproj::Project.open(project_path)

target = project.targets.find { |t| t.name == 'leela' }
abort 'target leela not found' unless target

NAME = 'Sync board into bundle'

target.build_phases.select { |p| p.respond_to?(:name) && p.name == NAME }.each do |phase|
  target.build_phases.delete(phase)
end

phase = target.new_shell_script_build_phase(NAME)
phase.shell_script = '"$SRCROOT/sync_board.sh"'
phase.show_env_vars_in_log = '0'
# Named so Xcode can skip the phase when nothing changed, and so the log says
# which board went in.
phase.input_paths = []
phase.output_paths = []

target.build_phases.delete(phase)
target.build_phases.unshift(phase)

project.save
puts "build phase '#{NAME}' added, first in target leela"
