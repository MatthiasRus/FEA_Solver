classdef Viewer
    properties
        LineSize = 0.1;
        Figure;
    end

    methods
        function obj =  Viewer()
            obj.Figure = figure;
        end

        function Render(obj, Controller)
            for i = 1 : length(Controller.STRNodes)
                targetNode = Controller.STRNodes(i);
                obj.RenderNode(targetNode);
            end

            for i = 1 : length(Controller.STRLines)
                targetLine = Controller.STRLines(i);
                obj.RenderLine(targetLine);
            end
        end

        function RenderNode(obj,node)
            plot3(gca,node.X,node.Y,node.Z,'--rs');
            hold on
        end

        function RenderLine(obj,line)
            x = [line.Node1.X, line.Node2.X];
            y = [line.Node1.Y, line.Node2.Y];
            z = [line.Node1.Z, line.Node2.Z];
            plot3(gca,x,y,z,'-b');
            hold on
        end
    end
end