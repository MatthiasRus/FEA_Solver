classdef STRLoads
    properties 
        Id;
        Name;
    end

    methods
        function obj = STRLoads(id,name)
            obj.Id = id;
            obj.Name = name;
        end


        function ToString(obj)
               fprintf('Load (%s)  #%i\n',obj.Name, obj.Id);
        end
    end
end