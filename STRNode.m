classdef STRNode <handle
    properties
        Id;
        X;
        Y;
        Z;
        Support;
    end
    %% 
    methods
        function obj = STRNode(id, x,y,z)
            obj.Id = id;
            obj.X = x;
            obj.Y = y;
            obj.Z = z;
        end
        %% 
        function ToString(obj)
            fprintf('Node (');
            if (~isobject(obj.Support))
                fprintf('Free');
            else
                fprintf(obj.Support.Name);
            end
            fprintf(') #%i at [%5.2f, %5.2f, %5.2f]\n',obj.Id,obj.X,obj.Y,obj.Z);            
        end
        %% 
    end
end