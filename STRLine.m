classdef STRLine <handle
    properties
        Id;
        Node1;
        Node2;
        Section;
        Material; 
        Release;
    end

    methods
        function obj = STRLine(id,node1,node2)
            obj.Id = id;
            obj.Node1 = node1;
            obj.Node2 = node2;
        end

        function ToString(obj)
            fprintf('Line #%i (N%i -> N%i)\n',obj.Id,obj.Node1.Id,obj.Node2.Id);
            if (~isobject(obj.Material))
                fprintf('Material : N/A\n');
            else
                fprintf('Material %s\n',obj.Material.Name);
            end

            if (~isobject(obj.Section))
                fprintf('Section : No Section\n');
            else
                fprintf('Section %s\n',obj.Section.Name);
            end

            if (~isobject(obj.Release))
                fprintf('Release : No Release\n');
            else
                fprintf('Release %s\n',obj.Release.Name);
            end
        end

    end


end
