import { Text, View } from 'react-native';
import { TestNavLinks } from '~/components/TestNavLinks';

export default function Sails() {
  return (
    <View
      style={{
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <Text>Sails</Text>
      <TestNavLinks />
    </View>
  );
}
