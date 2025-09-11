classdef STRMaterial
    properties
        Id;
        Name;
        E; %Young's Modulus
        G;
        mu; % possion Ration
    end

    methods
        function obj = STRMaterial(id, name, e, p)
            obj.Id = id;
            obj.Name = name;
            obj.E = e;
            obj.mu = p;
        end
        
        function ToString(obj)
            fprintf('Material (%s) #%i\n', obj.Name, obj.Id);
        end
    end
end
