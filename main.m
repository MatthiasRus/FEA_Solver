clc
clear
close all
controller = STRController();
%viewer = Viewer();

node1 = controller.AddSTRNode(0,0,0);
node2 = controller.AddSTRNode(0,0,10);
node3 = controller.AddSTRNode(10,0,10);
node4 = controller.AddSTRNode(10,0,0);

line1 = controller.AddSTRLine(node1,node2);
line2 = controller.AddSTRLine(node2,node3);
line3 = controller.AddSTRLine(node3,node4);
%line4 = controller.AddSTRLine(node1,node4);
support = controller.AddSTRSupport('Pinned',1e15,1e15,1e15,1e-4,1e-4,1e-4);

support1 = controller.AddSTRSupportPinned('Pinned');
support2 = controller.AddSTRSupportFixed('Fixed');
support3 = controller.AddSTRSupportRoller('Roller');

section = controller.AddSTRSectionRectangular('300X500',0.3,0.5);
section2 = controller.AddSTRSection('Section2', 3,4,5,6);

material1 = controller.AddSTRMaterial('Steel',200e9,0.3);
material2 = controller.AddSTRMaterial('Concrete',20e9,0.2);

release1 = controller.AddSTRRelease('Pin-rigid', 1e15,1e15,1e15,1e-4,1e-4,1e-4, 1e15,1e15,1e15, 1e15,1e15,1e15);
release2 = controller.AddSTRReleasePinnedRigid('Pin-rigid2');
release3 = controller.AddSTRReleaseRigidPinned('Rigid-Pin');
release4 = controller.AddSTRReleasePinnedPinned('Pin-Pin');

load1 = controller.AddSTRLoad('DL');
load2 = controller.AddSTRLoad('LL');
load3 = controller.AddSTRLoad('WL');

nodalLoad1 = controller.AddSTRNodalLoad(45,23,32,0,0,9);
controller.ApplyLoad(nodalLoad1,[1 3 5]);
controller.DeleteLoad(nodalLoad1);
controller.ApplyLoad(nodalLoad1,[1 2 4]);

lineLoad1 = controller.AddSTRLineLoadConcentrated(122,122,122,0,0,0,5.983);

controller.ApplyLoad(lineLoad1, [1 5]);

controller.ApplyMaterial(line1,material1);
controller.ApplyMaterial(line2, material2);
controller.DeleteMaterial(line1);

controller.ApplySupport(node1,support2);

controller.ApplySection(line1,section);
controller.ApplySection(line2,section);
controller.ApplySection(line3,section2);

controller.ApplyRelease(line1,release1);
controller.ApplyRelease(line2,release3);
controller.ApplyRelease(line3,release4);
controller.DeleteRelease(line3);

controller.ToString();

%viewer.Render(controller);
